"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ServiceEnvironment_1 = require("./ServiceEnvironment");
var env = new ServiceEnvironment_1.ServiceEnvironment({
    serverOptions: {
        port: 1818
    }
});
env.start(function (s) {
    console.log('Started on port', s.address().port);
});
