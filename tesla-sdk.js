const tjs = require('teslajs');
//
//var username = "";
//var password = "";
//// var mfaPassCode = "<your MFA passcode, if applicable>";
//
//tjs.login({
//    username: username,
//    password: password
//}, function(err, result) {
//    if (result.error) {
//        console.log(JSON.stringify(result.error));
//        process.exit(1);
//    }
//
//    var token = JSON.stringify(result.authToken);
//
//    if (token) {
//        console.log("Login Succesful!");
//        console.log(token);
//    }
//
//});

const vehicleDetails = async (token) => {
    try {
        return await tjs.vehicleAsync({ authToken: token });
    } catch (e) {
        console.error(e);
    }
};

// const myTest = async () => {
//     const vehicle = await vehicleDetails();
//     console.log(vehicle);
// }
//
// myTest();

module.exports = { vehicleDetails };