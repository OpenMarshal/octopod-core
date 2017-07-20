"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var webdav_server_1 = require("webdav-server");
function watchFile(env, ctx, data, cb) {
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
    ctx.getResource(function (e, r) {
        if (e) {
            console.error('TRACE > ctx.getResource(...) : Error', e);
            if (!ctx.setCodeFromError(e))
                ctx.setCode(webdav_server_1.v2.HTTPCodes.InternalServerError);
            return cb();
        }
        r.fs.lastModifiedDate(ctx, r.path, function (e, date) {
            folderNotify[name][path] = Date.now();
            if (date >= lastCheck) {
                ctx.setCode(webdav_server_1.v2.HTTPCodes.OK);
                ctx.response.write(JSON.stringify({
                    path: r.path.toString(),
                    deleted: !!e,
                    lastModifiedDate: date ? date : undefined
                }));
                cb();
            }
            ctx.setCode(webdav_server_1.v2.HTTPCodes.OK);
            ctx.response.write(JSON.stringify(undefined));
            cb();
        });
    });
}
exports.watchFile = watchFile;
