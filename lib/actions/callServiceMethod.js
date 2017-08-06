"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webdav_server_1 = require("webdav-server");
// Someone else ask for a service
function callServiceMethod(env, ctx, data, cb) {
    var methodName = ctx.requested.path.fileName();
    var serviceName = ctx.requested.path.getParent().fileName();
    var service = env.services[serviceName];
    if (!service) {
        ctx.setCode(webdav_server_1.v2.HTTPCodes.NotFound);
        return cb();
    }
    var method = service.inputs[methodName];
    if (!method) {
        ctx.setCode(webdav_server_1.v2.HTTPCodes.NotFound);
        return cb();
    }
    var nb = (method.outputs ? Object.keys(method.outputs).length : 0) + 1;
    var outputs = {};
    if (!env.callServiceMethod_serviceOutputsIndex)
        env.callServiceMethod_serviceOutputsIndex = {};
    var serviceOutputsIndex = env.callServiceMethod_serviceOutputsIndex;
    var next = function () {
        if (--nb !== 0)
            return;
        var create = function () {
            var name = Math.random().toString();
            var path = ctx.requested.path.toString(true) + name;
            ctx.getResource(path, function (e, r) {
                r.openWriteStream('mustCreate', function (e, writter) {
                    if (e)
                        return process.nextTick(function () { return create(); });
                    var mainOutput = method.mainOutputMethod ? outputs[method.mainOutputMethod][0] : undefined;
                    writter.end(JSON.stringify({
                        data: JSON.parse(data.toString()),
                        path: path,
                        outputs: outputs,
                        mainOutput: mainOutput
                    }), function (e) {
                        ctx.setCode(webdav_server_1.v2.HTTPCodes.Created);
                        ctx.response.write(JSON.stringify({
                            inputPath: path,
                            inputFileName: name,
                            outputs: outputs,
                            mainOutput: mainOutput
                        }));
                        cb();
                    });
                });
            });
        };
        create();
    };
    if (method.outputs) {
        var _loop_1 = function (outputMethodName) {
            var mnb = method.outputs[outputMethodName];
            nb += mnb;
            var _loop_2 = function (i) {
                var reengage = function () {
                    var root = '/services/' + serviceName + '/' + outputMethodName + '/';
                    if (serviceOutputsIndex[root] === undefined)
                        serviceOutputsIndex[root] = 0;
                    var current = ++serviceOutputsIndex[root];
                    ctx.getResource(root + current, function (e, r) {
                        r.fs.create(ctx, root + current, webdav_server_1.v2.ResourceType.File, function (e) {
                            if (e)
                                return reengage();
                            if (!outputs[outputMethodName])
                                outputs[outputMethodName] = [];
                            outputs[outputMethodName].push(root + current);
                            next();
                        });
                    });
                };
                reengage();
            };
            for (var i = 0; i < mnb; ++i) {
                _loop_2(i);
            }
            next();
        };
        for (var outputMethodName in method.outputs) {
            _loop_1(outputMethodName);
        }
    }
    next();
}
exports.callServiceMethod = callServiceMethod;
