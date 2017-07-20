"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var OctopodCore_1 = require("./OctopodCore");
var env = new OctopodCore_1.OctopodCore({
    serverOptions: {
        port: 1818
    }
});
env.start(function (s) {
    console.log('Started on port', s.address().port);
});
