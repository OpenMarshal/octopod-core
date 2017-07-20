/// <reference types="node" />
import { OctopodCore } from '../OctopodCore';
import { v2 as webdav } from 'webdav-server';
export declare function checkNewInputFiles(env: OctopodCore, ctx: webdav.HTTPRequestContext, data: Buffer, cb: () => void): void;
