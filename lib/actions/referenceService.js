"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webdav_server_1 = require("webdav-server");
var crypto = require("crypto");
var fs = require("fs");
// Service owner reference its service
function referenceService(env, ctx, data, cb) {
    if (!ctx.user) {
        ctx.setCode(webdav_server_1.v2.HTTPCodes.Unauthorized);
        return cb();
    }
    var nb = 1;
    var done = function () {
        if (--nb !== 0)
            return;
        ctx.setCode(webdav_server_1.v2.HTTPCodes.OK);
        cb();
    };
    var create = function (path, info, callback) {
        info = info ? info : {
            outputs: {}
        };
        info.isVolatile = info.isVolatile !== undefined ? info.isVolatile : false;
        var next = function () {
            if (info.encrypt) {
                fs.mkdir('../stored', function () {
                    env.cryptedSerializer.createNewFileSystem('../stored/' + crypto.createHash('sha1').update(path.toString()).digest('hex'), function (e, vsfs) {
                        if (info.isVolatile)
                            vsfs.doNotSerialize();
                        env.server.setFileSystem(path, vsfs, false, function (success) {
                            callback();
                        });
                    });
                });
            }
            else if (info.isVolatile) {
                var fs_1 = new webdav_server_1.v2.VirtualFileSystem();
                fs_1.doNotSerialize();
                env.server.setFileSystem(path, fs_1, false, function (success) {
                    callback();
                });
            }
            else {
                env.server.getFileSystem(path, function (fs, root, sub) {
                    fs.create(ctx, sub, webdav_server_1.v2.ResourceType.Directory, true, function (e) { return callback(); });
                });
            }
        };
        if (!info.flushed)
            return next();
        env.server.getFileSystem(path, function (fs, root, subPath) {
            fs.delete(ctx, subPath, function (e) {
                next();
            });
        });
    };
    var infoData = JSON.parse(data.toString());
    env.services[infoData.name] = {
        aliases: infoData.aliases ? infoData.aliases : [],
        inputs: infoData.inputs ? infoData.inputs : {},
        name: infoData.name
    };
    var info = env.services[infoData.name];
    var root = new webdav_server_1.v2.Path('/services/' + info.name);
    env.server.privilegeManager.setRights(ctx.user, root.toString(), ['all']);
    if (info.inputs) {
        nb += Object.keys(info.inputs).length;
        for (var method in info.inputs) {
            if (info.inputs[method].mainOutputMethod) {
                if (!info.inputs[method].outputs) {
                    info.inputs[method].outputs = (_a = {},
                        _a[info.inputs[method].mainOutputMethod] = 1,
                        _a);
                }
                else if (!info.inputs[method].outputs[info.inputs[method].mainOutputMethod]) {
                    info.inputs[method].outputs[info.inputs[method].mainOutputMethod] = 1;
                }
            }
            if (info.inputs[method].outputs) {
                nb += Object.keys(info.inputs[method].outputs).length;
                for (var outputMethod in info.inputs[method].outputs)
                    create(root.getChildPath(outputMethod), info.inputs[outputMethod], function () { return done(); });
            }
            create(root.getChildPath(method), info.inputs[method], function () { return done(); });
        }
    }
    create(root, undefined, function () { return done(); });
    var _a;
}
exports.referenceService = referenceService;
