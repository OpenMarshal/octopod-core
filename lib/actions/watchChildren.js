"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webdav_server_1 = require("webdav-server");
function watchChildren(env, ctx, data, cb) {
    if (!ctx.user) {
        ctx.setCode(webdav_server_1.v2.HTTPCodes.Unauthorized);
        return cb();
    }
    if (!env.checkNewInputFiles_folderNotify)
        env.checkNewInputFiles_folderNotify = {};
    var folderNotify = env.checkNewInputFiles_folderNotify;
    var config = JSON.parse(data.toString());
    var path = ctx.requested.path.toString(true);
    var name = ctx.user.username + ctx.headers.find('etag', '');
    var lastCheck;
    if (!folderNotify[name])
        folderNotify[name] = {};
    if (folderNotify[name][path])
        lastCheck = folderNotify[name][path];
    else
        lastCheck = config.getCurrent || config.getCurrent === undefined || config.getCurrent === null ? 0 : Date.now();
    var list = [];
    ctx.getResource(function (e, r) {
        if (e) {
            console.error('TRACE > ctx.getResource(...) : Error', e);
            if (!ctx.setCodeFromError(e))
                ctx.setCode(webdav_server_1.v2.HTTPCodes.InternalServerError);
            return cb();
        }
        r.readDir(function (e, files) {
            if (e) {
                console.error('TRACE > r.readDir(...) : Error', e);
                if (!ctx.setCodeFromError(e))
                    ctx.setCode(webdav_server_1.v2.HTTPCodes.InternalServerError);
                return cb();
            }
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
                    if (e) {
                        console.error('TRACE > r.fs.lastModifiedDate(...) : Error', e);
                        return go();
                    }
                    if (date >= lastCheck) {
                        list.push({
                            path: filePath,
                            lastModifiedDate: date
                        });
                    }
                    go();
                });
            });
        });
    });
}
exports.watchChildren = watchChildren;
