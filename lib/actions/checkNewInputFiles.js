"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webdav_server_1 = require("webdav-server");
// Service owner check new input files
function checkNewInputFiles(env, ctx, data, cb) {
    if (!ctx.user) {
        ctx.setCode(webdav_server_1.v2.HTTPCodes.Unauthorized);
        return cb();
    }
    if (!env.checkNewInputFiles_folderNotify)
        env.checkNewInputFiles_folderNotify = {};
    var folderNotify = env.checkNewInputFiles_folderNotify;
    var methodName = ctx.requested.path.fileName();
    var serviceName = ctx.requested.path.getParent().fileName();
    var service = env.services[serviceName];
    var method = service.inputs[methodName];
    var path = ctx.requested.path.toString(true);
    var name = ctx.user.username + ctx.headers.find('etag', '');
    var lastCheck = 0;
    if (!folderNotify[name])
        folderNotify[name] = {};
    if (folderNotify[name][path])
        lastCheck = folderNotify[name][path];
    var list = [];
    ctx.getResource(function (e, r) {
        if (e)
            return console.error('TRACE > ctx.getResource(...) : Error', e);
        r.readDir(function (e, files) {
            if (e)
                return console.error('TRACE > r.readDir(...) : Error', e);
            var nb = files.length + 1;
            var go = function () {
                if (--nb === 0) {
                    ctx.setCode(webdav_server_1.v2.HTTPCodes.OK);
                    ctx.response.write(JSON.stringify(list));
                    folderNotify[name][path] = Date.now();
                    cb();
                }
            };
            go();
            files.forEach(function (file) {
                var filePath = r.path.toString(true) + file;
                r.fs.lastModifiedDate(ctx, filePath, function (e, date) {
                    if (e)
                        return console.error('TRACE > r.fs.lastModifiedDate(...) : Error', e);
                    if (date < lastCheck)
                        return go();
                    r.fs.openReadStream(ctx, filePath, function (e, rStream) {
                        if (e)
                            return console.error('TRACE > r.fs.openReadStream(...) : Error', e);
                        var data = '';
                        rStream.on('data', function (chunk) {
                            data += chunk.toString();
                        });
                        rStream.on('end', function () {
                            list.push(JSON.parse(data));
                            go();
                        });
                    });
                });
            });
        });
    });
}
exports.checkNewInputFiles = checkNewInputFiles;
