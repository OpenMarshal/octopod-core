import { ServiceReferenceExtended, ServiceReferenceInput } from 'octopod'
import { ServiceInput, ServiceInputResponse } from '../Types'
import { OctopodCore } from '../OctopodCore'
import { v2 as webdav } from 'webdav-server'
import * as crypto from 'crypto'
import * as fs from 'fs'

// Service owner reference its service
export function referenceService(env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void)
{
    if(!ctx.user)
    {
        ctx.setCode(webdav.HTTPCodes.Unauthorized);
        return cb();
    }

    let nb = 1;
    const done = () =>
    {
        if(--nb !== 0)
            return;

        ctx.setCode(webdav.HTTPCodes.OK);
        cb();
    }

    const create = (path : webdav.Path, info : ServiceReferenceInput, callback : () => void) =>
    {
        info = info ? info : {
            outputs: {}
        };
        info.isVolatile = info.isVolatile !== undefined ? info.isVolatile : false;

        const next = () => {
            if(info.encrypt)
            {
                fs.mkdir('../stored', () => {
                    env.cryptedSerializer.createNewFileSystem('../stored/' + crypto.createHash('sha1').update(path.toString()).digest('hex'), (e, vsfs) => {
                        if(info.isVolatile)
                            vsfs.doNotSerialize();

                        env.server.setFileSystem(path, vsfs, false, (success) => {
                            callback();
                        });
                    })
                })
            }
            else if(info.isVolatile)
            {
                const fs = new webdav.VirtualFileSystem();
                fs.doNotSerialize();

                env.server.setFileSystem(path, fs, false, (success) => {
                    callback();
                });
            }
            else
            {
                env.server.getFileSystem(path, (fs, root, sub) => {
                    fs.create(ctx, sub, webdav.ResourceType.Directory, true, (e) => callback());
                })
            }
        }

        if(!info.flushed)
            return next();

        env.server.getFileSystem(path, (fs, root, subPath) => {
            fs.delete(ctx, subPath, (e) => {
                next();
            })
        })
    }

    const infoData : ServiceReferenceExtended = JSON.parse(data.toString());
    env.services[infoData.name] = {
        aliases: infoData.aliases ? infoData.aliases : [],
        inputs: infoData.inputs ? infoData.inputs : {},
        name: infoData.name
    };
    const info = env.services[infoData.name];
    
    const root = new webdav.Path('/services/' + info.name);
    (env.server.privilegeManager as webdav.SimplePathPrivilegeManager).setRights(ctx.user, root.toString(), [ 'all' ]);
    if(info.inputs)
    {
        nb += Object.keys(info.inputs).length;
        for(const method in info.inputs)
        {
            if(info.inputs[method].outputs)
            {
                nb += Object.keys(info.inputs[method].outputs).length;
                for(const outputMethod in info.inputs[method].outputs)
                    create(root.getChildPath(outputMethod), info.inputs[outputMethod], () => done());
            }
            create(root.getChildPath(method), info.inputs[method], () => done());
        }
    }

    create(root, undefined, () => done());
}
