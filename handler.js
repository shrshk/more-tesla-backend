'use strict';

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const dynamo = new AWS.DynamoDB({apiVersion: "2012-08-10"});
const tesla_sdk = require('./tesla-sdk');

const CHATCONNECTION_TABLE = 'TeslaBotTable';

const successfullResponse = {
  statusCode: 200,
  body: 'everything is alright'
};

module.exports.connectionHandler = async (event, context, callback) => {
  console.log(event);
  try {
    if (event.requestContext.eventType === 'CONNECT') {
      // Handle connection
      await addConnection(event);
      callback(null, successfullResponse);
    } else if (event.requestContext.eventType === 'DISCONNECT') {
      // Handle disconnection
      await deleteConnection(event.requestContext.connectionId);
      callback(null, successfullResponse);
    }
  } catch (err) {
    console.log(err.toString());
    callback(null, JSON.stringify(err));
  }
};

// THIS ONE DOESNT DO ANYHTING
module.exports.defaultHandler = async (event, context, callback) => {
  console.log('defaultHandler was called');
  console.log(event);

  callback(null, {
    statusCode: 200,
    body: 'defaultHandler'
  });
};

module.exports.sendMessageHandler = async (event, context, callback) => {
  try {
    console.log("event before sendMessage  " + event.toString());
    await sendMessageToConnection(event);
    callback(null, successfullResponse);
  } catch (err) {
    callback(null, JSON.stringify(err));
  }
}

const sendMessageToConnection = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body);
  const postData = body.data;
  try {
    // TODO: Insert DialogFlow SDK here which calls corresponding tesla SDK method.
    const tableData = await getItemWithConnectionId(connectionId);
    console.log("table data : " + tableData.toString());
    const { Item } = tableData;
    const { authToken } = Item;
    const { S: authTokenVal } = authToken;
    const vehicleInfo = await tesla_sdk.vehicleDetails(authTokenVal);
    const data = {
      vehicleInfo,
      customMessage: postData
    };
    return send(event, connectionId, data);
  } catch (e) {
    console.log("error in send message function" + e.toString());
    throw new Error(e.toString());
  }
}

const getItemWithConnectionId = async (connectionId) => {
  const params = {
    TableName: CHATCONNECTION_TABLE,
    Key: {
      "connectionId": {
        S: connectionId
      }
    }
  };
  return await dynamo.getItem(params).promise();
}

const send = (event, connectionId, data) => {
  console.log("data in send" + data.toString());
  const endpoint = event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint
  });

  const params = {
    ConnectionId: connectionId,
    Data: JSON.stringify(data)
  };
  return apigwManagementApi.postToConnection(params).promise();
};

const addConnection = async (event) => {
  // temporary authToken needs to be handled by auth lambda
  const headers = event.headers;
  const connectionId = event.requestContext.connectionId;

  if (headers==null || headers['authToken'] === undefined)
    throw new Error('no authToken in the header');
  const authToken = headers['authToken'];

  const params = {
    TableName: CHATCONNECTION_TABLE,
    Item: {
      connectionId: {
        S: connectionId
      },
      authToken: {
        S: authToken
      }
    }
  };

  return await dynamo.putItem(params).promise();
};

const deleteConnection = async (connectionId) => {
  const params = {
    TableName: CHATCONNECTION_TABLE,
    Key: {
      connectionId: {
        S: connectionId
      }
    }
  };

  return await dynamo.deleteItem(params).promise();
};