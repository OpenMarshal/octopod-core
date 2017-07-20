import { WatchFileResponse, WatchFileRequest } from 'octopod'
import { OctopodCore } from '../OctopodCore'
import { v2 as webdav } from 'webdav-server'

export function watchFile(env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void)
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
    
    ctx.getResource((e, r) => {
        if(e)
        {
            console.error('TRACE > ctx.getResource(...) : Error', e);
            if(!ctx.setCodeFromError(e))
                ctx.setCode(webdav.HTTPCodes.InternalServerError);
            return cb();
        }

        r.fs.lastModifiedDate(ctx, r.path, (e, date) => {
            folderNotify[name][path] = Date.now();
            if(date >= lastCheck)
            {
                ctx.setCode(webdav.HTTPCodes.OK);
                ctx.response.write(JSON.stringify({
                    path: r.path.toString(),
                    deleted: !!e,
                    lastModifiedDate: date ? date : undefined
                } as WatchFileResponse));
                cb();
            }
            
            ctx.setCode(webdav.HTTPCodes.OK);
            ctx.response.write(JSON.stringify(undefined));
            cb();
        })
    })
}
