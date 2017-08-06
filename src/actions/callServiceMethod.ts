import { ServiceInput, ServiceInputResponse } from '../Types'
import { OctopodCore } from '../OctopodCore'
import { v2 as webdav } from 'webdav-server'

// Someone else ask for a service
export function callServiceMethod(env : OctopodCore, ctx : webdav.HTTPRequestContext, data : Buffer, cb : () => void)
{
    const methodName = ctx.requested.path.fileName();
    const serviceName = ctx.requested.path.getParent().fileName();
    const service = env.services[serviceName];
    if(!service)
    {
        ctx.setCode(webdav.HTTPCodes.NotFound);
        return cb();
    }
    const method = service.inputs[methodName];
    if(!method)
    {
        ctx.setCode(webdav.HTTPCodes.NotFound);
        return cb();
    }

    let nb = (method.outputs ? Object.keys(method.outputs).length : 0) + 1;
    const outputs : { [method : string] : string[] } = {};

    if(!(env as any).callServiceMethod_serviceOutputsIndex)
        (env as any).callServiceMethod_serviceOutputsIndex = {};

    const serviceOutputsIndex : {
        [parentPath : string] : number
    } = (env as any).callServiceMethod_serviceOutputsIndex;

    const next = () =>
    {
        if(--nb !== 0)
            return;
        
        const create = () => {
            const name = Math.random().toString();
            const path = ctx.requested.path.toString(true) + name;
            ctx.getResource(path, (e, r) => {
                r.openWriteStream('mustCreate', (e, writter) => {
                    if(e)
                        return process.nextTick(() => create());
                    
                    const mainOutput = method.mainOutputMethod ? outputs[method.mainOutputMethod][0] : undefined;
                    
                    writter.end(JSON.stringify({
                        data: JSON.parse(data.toString()),
                        path,
                        outputs,
                        mainOutput
                    } as ServiceInput), (e) => {
                        ctx.setCode(webdav.HTTPCodes.Created);
                        ctx.response.write(JSON.stringify({
                            inputPath: path,
                            inputFileName: name,
                            outputs,
                            mainOutput
                        } as ServiceInputResponse));
                        cb();
                    })
                })
            })
        }
        create();
    }

    if(method.outputs)
    {
        for(const outputMethodName in method.outputs)
        {
            const mnb = method.outputs[outputMethodName];
            nb += mnb;
            for(let i = 0; i < mnb; ++i)
            {
                const reengage = () => {
                    const root = '/services/' + serviceName + '/' + outputMethodName + '/';
                    if(serviceOutputsIndex[root] === undefined)
                        serviceOutputsIndex[root] = 0;
                    const current = ++serviceOutputsIndex[root];

                    ctx.getResource(root + current, (e, r) => {
                        r.fs.create(ctx, root + current, webdav.ResourceType.File, (e) => {
                            if(e)
                                return reengage();

                            if(!outputs[outputMethodName])
                                outputs[outputMethodName] = [];
                            outputs[outputMethodName].push(root + current);
                            next();
                        })
                    })
                }
                reengage();
            }
            next();
        }
    }
    next();
}
