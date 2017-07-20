import { OctopodCore } from './OctopodCore'

const env = new OctopodCore({
    serverOptions: {
        port: 1818
    }
});
env.start((s) => {
    console.log('Started on port', s.address().port);
});
