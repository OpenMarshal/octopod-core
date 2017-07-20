# octopod-core


```typescript
import { OctopodCore } from 'octopod-core'

const env = new OctopodCore({
    serverOptions: {
        port: 1818
    }
});
env.start((s) => {
    console.log('Started on port', s.address().port);
});
```
