import { WatchFileResponse, WatchFileRequest } from 'octopod'
import { OctopodCore } from '../OctopodCore'
import { v2 as webdav } from 'webdav-server'

export function watchChildren(env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void)
{
    if(!ctx.user)
    {
        ctx.setCode(webdav.HTTPCodes.Unauthorized);
        return cb();
    }

    if(!(env as any).checkNewInputFiles_folderNotify)
        (env as any).checkNewInputFiles_folderNotify = {};
    const folderNotify = (env as any).checkNewInputFiles_folderNotify;

    const config : WatchFileRequest = JSON.parse(data.toString());

    const path = ctx.requested.path.toString(true);
    const name = ctx.user.username + ctx.headers.find('etag', '');
    let lastCheck : number;
    if(!folderNotify[name])
        folderNotify[name] = {};
    if(folderNotify[name][path])
        lastCheck = folderNotify[name][path];
    else
        lastCheck = config.getCurrent || config.getCurrent === undefined || config.getCurrent === null ? 0 : Date.now();
    
    const list : WatchFileResponse[] = [];
    
    ctx.getResource((e, r) => {
        if(e)
        {
            console.error('TRACE > ctx.getResource(...) : Error', e);
            if(!ctx.setCodeFromError(e))
                ctx.setCode(webdav.HTTPCodes.InternalServerError);
            return cb();
        }

        r.readDir((e, files) => {
            if(e)
            {
                console.error('TRACE > r.readDir(...) : Error', e);
                if(!ctx.setCodeFromError(e))
                    ctx.setCode(webdav.HTTPCodes.InternalServerError);
                return cb();
            }
            
            let nb = files.length + 1;
            const go = () => {
                if(--nb === 0)
                {
                    ctx.setCode(webdav.HTTPCodes.OK);
                    ctx.response.write(JSON.stringify(list));
                    folderNotify[name][path] = Date.now();
                    cb();
                }
            }
            go();
            
            files.forEach((file) => {
                const filePath = r.path.toString(true) + file;
                r.fs.lastModifiedDate(ctx, filePath, (e, date) => {
                    if(e)
                    {
                        console.error('TRACE > r.fs.lastModifiedDate(...) : Error', e);
                        return go();
                    }

                    if(date >= lastCheck)
                    {
                        list.push({
                            path: filePath,
                            lastModifiedDate: date
                        });
                    }
                    
                    go();
                })
            })
        })
    })
}
