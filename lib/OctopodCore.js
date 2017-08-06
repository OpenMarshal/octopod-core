"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var virtual_stored_1 = require("@webdav-server/virtual-stored");
var octopod_1 = require("octopod");
var checkNewInputFiles_1 = require("./actions/checkNewInputFiles");
var callServiceMethod_1 = require("./actions/callServiceMethod");
var referenceService_1 = require("./actions/referenceService");
var watchChildren_1 = require("./actions/watchChildren");
var watchFile_1 = require("./actions/watchFile");
var webdav_server_1 = require("webdav-server");
var OctopodCore = (function () {
    function OctopodCore(options) {
        this.services = {};
        this.actions = {};
        this.options = options ? options : {};
        this.options.encryption = this.options.encryption ? this.options.encryption : {
            password: 'password',
            options: {
                salt: 'this is the salt of the world',
                cipher: 'aes-256-cbc',
                cipherIvSize: 16,
                hash: 'sha256',
                masterNbIteration: 80000,
                minorNbIteration: 1000,
                keyLen: 256
            }
        };
        this.cryptedSerializer = new virtual_stored_1.VirtualStoredSerializer(this.options.encryption.password, this.options.encryption.options);
        this.registerServiceAction('check-service-input', checkNewInputFiles_1.checkNewInputFiles);
        this.registerServiceAction('reference-service', referenceService_1.referenceService);
        this.registerServiceAction('call-service', callServiceMethod_1.callServiceMethod);
        this.registerServiceAction('watch-children', watchChildren_1.watchChildren);
        this.registerServiceAction('watch-file', watchFile_1.watchFile);
    }
    OctopodCore.prototype.registerServiceAction = function (name, action) {
        this.actions[name] = action;
    };
    OctopodCore.prototype.start = function (callback) {
        var _this = this;
        var userManager = new webdav_server_1.v2.SimpleUserManager();
        var privilegeManager = new webdav_server_1.v2.SimplePathPrivilegeManager();
        var vfs = new webdav_server_1.v2.VirtualFileSystem();
        var vfsVolatile = new webdav_server_1.v2.VirtualFileSystem();
        var vfsVolatileGetter = new webdav_server_1.v2.VirtualFileSystem();
        vfsVolatile.doNotSerialize();
        vfsVolatileGetter.doNotSerialize();
        var saveDeCipher = new virtual_stored_1.DeCipher(this.options.encryption.password, this.options.encryption.options);
        var treeSeed = '.data is the seed';
        var serverOptions = this.options.serverOptions ? this.options.serverOptions : {};
        serverOptions.httpAuthentication = new webdav_server_1.v2.HTTPBasicAuthentication(userManager);
        serverOptions.privilegeManager = privilegeManager;
        serverOptions.rootFileSystem = vfs;
        serverOptions.autoSave = {
            treeFilePath: this.options.serverOptions && this.options.serverOptions.autoSave && this.options.serverOptions.autoSave.treeFilePath ? this.options.serverOptions.autoSave.treeFilePath : '.data',
            onSaveError: function () { return console.log('SAVE ERROR'); },
            streamProvider: function (cb) {
                cb(saveDeCipher.newCipher(treeSeed));
            }
        };
        serverOptions.autoLoad = {
            serializers: [
                this.cryptedSerializer
            ],
            streamProvider: function (stream, cb) {
                cb(stream.pipe(saveDeCipher.newDecipher(treeSeed)));
            }
        };
        var server = new webdav_server_1.v2.WebDAVServer(serverOptions);
        this.server = server;
        server.autoLoad(function (e) {
            if (e)
                console.log(e);
            var ctx = server.createExternalContext();
            server.setFileSystemSync('/process', vfsVolatile);
            vfsVolatile.openWriteStream(ctx, '/core.json', 'canCreate', function (e, stream) {
                if (e)
                    throw e;
                var data = JSON.stringify({
                    service: 'core',
                    lastUpdate: Date.now(),
                    pid: process.pid
                });
                stream.end(data);
            });
            userManager.getDefaultUser(function (user) { return privilegeManager.setRights(user, '/', ['all']); });
            /*
            server.method('BIND', {
                chunked(ctx : webdav.HTTPRequestContext, stream : Readable, cb : () => void)
                {
                    const create = () => {
                        const name = Math.random().toString();
                        const path = ctx.requested.path.toString(true) + name;
                        ctx.getResource(path, (e, r) => {
                            r.openWriteStream('mustCreate', (e, writter) => {
                                if(e)
                                    return process.nextTick(() => create());
                                
                                stream.pipe(writter);
                                writter.on('finish', () => {
                                    ctx.setCode(webdav.HTTPCodes.Created);
                                    ctx.response.setHeader('bind-name', name);
                                    ctx.response.setHeader('bind-path', path);
                                    cb();
                                })
                            })
                        })
                    }
                    create();
                }
            })*/
            var __this = _this;
            server.method('TRACE', {
                unchunked: function (ctx, data, cb) {
                    var action = ctx.headers.find('service-action');
                    if (!action || !__this.actions[action]) {
                        ctx.setCode(webdav_server_1.v2.HTTPCodes.BadRequest);
                        return cb();
                    }
                    __this.actions[action](__this, ctx, data, cb);
                }
            });
            if (_this.options.isVerbose) {
                server.afterRequest(function (ctx, next) {
                    console.log(ctx.request.method, ctx.requested.path.toString(), ctx.response.statusCode, ctx.response.statusMessage);
                    next();
                });
            }
            server.start(function (s) {
                s.on('connection', function (socket) {
                    socket.setTimeout(0);
                });
                _this.service = new octopod_1.Service('core', 'http://127.0.0.1:' + s.address().port);
                _this.service.reference({
                    inputs: {
                        'reserve-file': {
                            isVolatile: true,
                            flushed: true,
                            mainOutputMethod: 'reserve-file-result',
                            outputs: {
                                'reserve-file-result': 1
                            }
                        }
                    }
                }, function (e) {
                    _this.service.bindMethod('reserve-file', function (data, info) {
                        if (!data.generationSteps || data.generationSteps < 0)
                            data.generationSteps = 2;
                        var create = function () {
                            var names = [];
                            var nextName = function () {
                                names.push(Math.random().toString());
                                if (names.length < data.generationSteps)
                                    return process.nextTick(function () { return nextName(); });
                                var path = new webdav_server_1.v2.Path(data.path).toString(true) + names.join('_');
                                ctx.getResource(path, function (e, r) {
                                    r.create(webdav_server_1.v2.ResourceType.File, true, function (e) {
                                        if (e === webdav_server_1.v2.Errors.ResourceAlreadyExists)
                                            return process.nextTick(function () { return create(); });
                                        if (e) {
                                            _this.service.error('reserve-file > create', e);
                                            return process.nextTick(function () { return create(); });
                                        }
                                        _this.service.putObject(info.mainOutput, {
                                            path: path
                                        }, function (e) {
                                        });
                                    });
                                });
                            };
                            nextName();
                        };
                        create();
                    });
                });
                if (callback)
                    callback(s, server);
            });
        });
    };
    return OctopodCore;
}());
exports.OctopodCore = OctopodCore;
