'use strict';

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const dynamo = new AWS.DynamoDB({apiVersion: "2012-08-10"});
const tesla_sdk = require('./tesla-sdk');

const CHAT_CONNECTION_TABLE = 'TeslaBotTable';

const successfulResponse = {
  statusCode: 200,
  body: 'everything is alright'
};

module.exports.connectionHandler = async (event, context, callback) => {
  console.log(JSON.stringify(event));
  try {
    if (event.requestContext.eventType === 'CONNECT') {
      // Handle connection
      await addConnection(event);
      callback(null, successfulResponse);
    } else if (event.requestContext.eventType === 'DISCONNECT') {
      // Handle disconnection
      await deleteConnection(event.requestContext.connectionId);
      callback(null, successfulResponse);
    }
  } catch (err) {
    console.log(JSON.stringify(err));
    callback(null, JSON.stringify(err));
  }
};

module.exports.defaultHandler = async (event, context, callback) => {
  console.log(JSON.stringify(event));
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body);
  const inputMessage = body.data;
  const { action } = body;
  const connectionObj = await getItemWithConnectionId(connectionId);

  if (JSON.stringify(connectionObj) === '{}') {
    throw new Error(JSON.stringify("No connection found for: " + connectionId));
  }

  console.log('connection Obj is: ' + connectionObj.toString())

  try {
    const responseData = await customHandlers[action](connectionObj, inputMessage);
    await send(event, connectionId, responseData);
    callback(null, successfulResponse);
  } catch (err) {
    await send(event, connectionId, JSON.stringify(err));
    await deleteConnection(connectionId);
    callback(null, JSON.stringify(err));
  }
};

const moreTeslaHandler = async (connectionObj, inputMessage) => {
  try {
    console.log("input message is : " + inputMessage.toString());
    const { Item } = connectionObj;
    const { authToken } = Item;
    const { S: authTokenVal } = authToken;
    // TODO: Insert DialogFlow SDK here which calls corresponding tesla SDK method.
    const vehicleInfo = await tesla_sdk.vehicleDetails(authTokenVal);
    const { display_name: displayName } = vehicleInfo;
    return `My name is ${displayName}`;
  } catch (err) {
    console.log("error in moreTeslaHandler" + JSON.stringify(err));
    throw new Error(JSON.stringify(err));
  }
}

const authHandler = async (connectionObj, inputMessage) => {
  // temporary authToken needs to be handled by auth lambda
  console.log('input message in authHandler' + inputMessage);
  if (inputMessage==null || inputMessage['authToken'] === undefined)
    throw new Error('no authToken in the inputJsonMessage');

  const { authToken } = inputMessage;

  const { Item } = connectionObj;
  const { connectionId } = Item;
  const { S: connectionIdVal } = connectionId;

  const params = {
    TableName: CHAT_CONNECTION_TABLE,
    Item: {
      connectionId: {
        S: connectionIdVal
      },
      authToken: {
        S: authToken
      }
    }
  };

  return await dynamo.putItem(params).promise();
}

const getItemWithConnectionId = async (connectionId) => {
  const params = {
    TableName: CHAT_CONNECTION_TABLE,
    Key: {
      "connectionId": {
        S: connectionId
      }
    }
  };
  return await dynamo.getItem(params).promise();
}

const send = async (event, connectionId, data) => {
  const endpoint = event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint
  });

  const params = {
    ConnectionId: connectionId,
    Data: JSON.stringify(data)
  };
  return await apigwManagementApi.postToConnection(params).promise();
};

const addConnection = async (event) => {
  const connectionId = event.requestContext.connectionId;

  const params = {
    TableName: CHAT_CONNECTION_TABLE,
    Item: {
      connectionId: {
        S: connectionId
      }
    }
  };

  return await dynamo.putItem(params).promise();
};

const deleteConnection = async (connectionId) => {
  const params = {
    TableName: CHAT_CONNECTION_TABLE,
    Key: {
      connectionId: {
        S: connectionId
      }
    }
  };

  return await dynamo.deleteItem(params).promise();
};

const customHandlers = {
  askTesla: moreTeslaHandler,
  auth: authHandler
}