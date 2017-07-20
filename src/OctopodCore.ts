import { DeCipher, VirtualStoredSerializer, DeCipherOptions } from '@webdav-server/virtual-stored'
import { ServiceReferenceExtended, ServiceReferenceInput, Service } from 'octopod'
import { ServiceInput, ServiceInputResponse } from './Types'
import { checkNewInputFiles } from './actions/checkNewInputFiles'
import { callServiceMethod } from './actions/callServiceMethod'
import { referenceService } from './actions/referenceService'
import { watchChildren } from './actions/watchChildren'
import { watchFile } from './actions/watchFile'
import { v2 as webdav } from 'webdav-server'
import * as https from 'https'
import * as http from 'http'

export interface OctopodCoreOptions
{
    serverOptions ?: webdav.WebDAVServerOptions
    encryption ?: {
        password : string
        options : DeCipherOptions
    }
}

export class OctopodCore
{
    actions : {
        [name : string] : (env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void) => void
    };
    
    services : {
        [name : string] : ServiceReferenceExtended
    };

    server : webdav.WebDAVServer;
    options : OctopodCoreOptions;
    
    cryptedSerializer : VirtualStoredSerializer;

    service : Service

    constructor(options ?: OctopodCoreOptions)
    {
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

        this.cryptedSerializer = new VirtualStoredSerializer(this.options.encryption.password, this.options.encryption.options);

        this.registerServiceAction('check-service-input', checkNewInputFiles);
        this.registerServiceAction('reference-service', referenceService);
        this.registerServiceAction('call-service', callServiceMethod);
        this.registerServiceAction('watch-children', watchChildren);
        this.registerServiceAction('watch-file', watchFile);
    }

    registerServiceAction(name : string, action : (env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void) => void) : void
    {
        this.actions[name] = action;
    }

    start(callback ?: (httpServer : http.Server | https.Server, webdavServer : webdav.WebDAVServer) => void)
    {
        const userManager = new webdav.SimpleUserManager();
        const privilegeManager = new webdav.SimplePathPrivilegeManager();
        const vfs = new webdav.VirtualFileSystem();
        const vfsVolatile = new webdav.VirtualFileSystem();
        const vfsVolatileGetter = new webdav.VirtualFileSystem();
        vfsVolatile.doNotSerialize();
        vfsVolatileGetter.doNotSerialize();

        const saveDeCipher = new DeCipher(this.options.encryption.password, this.options.encryption.options);
        const treeSeed = '.data is the seed';
        
        const serverOptions = this.options.serverOptions ? this.options.serverOptions : {};
        serverOptions.httpAuthentication = new webdav.HTTPBasicAuthentication(userManager);
        serverOptions.privilegeManager = privilegeManager;
        serverOptions.rootFileSystem = vfs;
        serverOptions.autoSave = {
            treeFilePath: this.options.serverOptions && this.options.serverOptions.autoSave && this.options.serverOptions.autoSave.treeFilePath ? this.options.serverOptions.autoSave.treeFilePath : '.data',
            onSaveError: () => console.log('SAVE ERROR'),
            streamProvider: (cb) => {
                cb(saveDeCipher.newCipher(treeSeed) as any);
            }
        };
        serverOptions.autoLoad = {
            serializers: [
                this.cryptedSerializer
            ],
            streamProvider: (stream, cb) => {
                cb(stream.pipe(saveDeCipher.newDecipher(treeSeed)) as any);
            }
        };

        const server = new webdav.WebDAVServer(serverOptions);
        this.server = server;

        server.autoLoad((e) => {
            if(e)
                console.log(e);

            const ctx = server.createExternalContext();

            server.setFileSystemSync('/process', vfsVolatile);

            vfsVolatile.openWriteStream(ctx, '/core.json', 'canCreate', (e, stream) => {
                if(e)
                    throw e;
                const data = JSON.stringify({
                    service: 'core',
                    lastUpdate: Date.now(),
                    pid: process.pid
                });
                stream.end(data);
            })

            userManager.getDefaultUser((user) => privilegeManager.setRights(user, '/', [ 'all' ]));
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

            const __this = this;

            server.method('TRACE', {
                unchunked(ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void)
                {
                    const action = ctx.headers.find('service-action');
                    if(!action || !__this.actions[action])
                    {
                        ctx.setCode(webdav.HTTPCodes.BadRequest);
                        return cb();
                    }

                    __this.actions[action](__this, ctx, data, cb);
                }
            })
            
            server.afterRequest((ctx, next) => {
                console.log(ctx.request.method, ctx.requested.path.toString(), ctx.response.statusCode, ctx.response.statusMessage)
                next();
            })
            server.start((s) => {
                s.on('connection', function(socket) {
                    socket.setTimeout(0);
                })

                this.service = new Service('core', 'http://127.0.0.1:' + s.address().port);
                /*
                this.service.reference({
                    inputs: {
                        'core-diagnostics': {
                            isVolatile: true,
                            flushed: true,
                            mainOutputMethod: 'core-result',
                            outputs: {
                                'core-result': 1
                            }
                        }
                    }
                }, (e) => {
                    this.service.bindMethod('core-diagnostics', (data, info) => {

                    })
                })*/

                if(callback)
                    callback(s, server);
            })
        })
    }
}
