/// <reference types="node" />
import { VirtualStoredSerializer, DeCipherOptions } from '@webdav-server/virtual-stored';
import { ServiceReferenceExtended, Service } from 'octopod';
import { v2 as webdav } from 'webdav-server';
import * as https from 'https';
import * as http from 'http';
export interface OctopodCoreOptions {
    serverOptions?: webdav.WebDAVServerOptions;
    encryption?: {
        password: string;
        options: DeCipherOptions;
    };
}
export declare class OctopodCore {
    actions: {
        [name: string]: (env: OctopodCore, ctx: webdav.HTTPRequestContext, data: Buffer, cb: () => void) => void;
    };
    services: {
        [name: string]: ServiceReferenceExtended;
    };
    server: webdav.WebDAVServer;
    options: OctopodCoreOptions;
    cryptedSerializer: VirtualStoredSerializer;
    service: Service;
    constructor(options?: OctopodCoreOptions);
    registerServiceAction(name: string, action: (env: OctopodCore, ctx: webdav.HTTPRequestContext, data: Buffer, cb: () => void) => void): void;
    start(callback?: (httpServer: http.Server | https.Server, webdavServer: webdav.WebDAVServer) => void): void;
}
