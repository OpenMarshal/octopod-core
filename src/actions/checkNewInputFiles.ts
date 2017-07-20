import { OctopodCore } from '../OctopodCore'
import { v2 as webdav } from 'webdav-server'
import { ServiceInput } from '../Types'

// Service owner check new input files
export function checkNewInputFiles(env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void)
{
    if(!ctx.user)
    {
        ctx.setCode(webdav.HTTPCodes.Unauthorized);
        return cb();
    }

    if(!(env as any).checkNewInputFiles_folderNotify)
        (env as any).checkNewInputFiles_folderNotify = {};
    const folderNotify = (env as any).checkNewInputFiles_folderNotify;

    const methodName = ctx.requested.path.fileName();
    const serviceName = ctx.requested.path.getParent().fileName();
    const service = env.services[serviceName];
    const method = service.inputs[methodName];

    const path = ctx.requested.path.toString(true);
    const name = ctx.user.username + ctx.headers.find('etag', '');
    let lastCheck = 0;
    if(!folderNotify[name])
        folderNotify[name] = {};
    if(folderNotify[name][path])
        lastCheck = folderNotify[name][path];
    
    const list : ServiceInput[] = [];
    
    ctx.getResource((e, r) => {
        if(e)
            return console.error('TRACE > ctx.getResource(...) : Error', e);

        r.readDir((e, files) => {
            if(e)
                return console.error('TRACE > r.readDir(...) : Error', e);
            
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
                        return console.error('TRACE > r.fs.lastModifiedDate(...) : Error', e);

                    if(date < lastCheck)
                        return go();

                    r.fs.openReadStream(ctx, filePath, (e, rStream) => {
                        if(e)
                            return console.error('TRACE > r.fs.openReadStream(...) : Error', e);

                        let data = '';

                        rStream.on('data', (chunk) => {
                            data += chunk.toString();
                        })
                        rStream.on('end', () => {
                            list.push(JSON.parse(data));
                            go();
                        })
                    })
                })
            })
        })
    })
}
