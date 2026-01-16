# Claude Projects API

Unofficial Node.js API for Claude Code.

## Install

```bash
npm install claude-projects-api
```

## Usage

```ts
import {Claude} from 'claude-projects-api';

const claude = Claude.spawn({
    cwd: '/path/to/project',
    model: 'sonnet',
});

claude.on('ready', async () => {
    const response = await claude.query('Hello!');
    console.log(response.text);
    await claude.close();
});
```

```ts
import {Scanner} from 'claude-projects-api';

const scanner = new Scanner();
const projects = await scanner.getProjects();
const sessions = await scanner.getSessions(projectHash);
const conversation = await scanner.getConversation(projectHash, sessionId);
```

## License

MIT
