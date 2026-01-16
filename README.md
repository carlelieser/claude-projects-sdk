# Claude Projects API

Unofficial Node.js API for Claude Code.

## Install

```bash
npm install claude-projects-api
```

## Usage

```ts
import {Claude} from 'claude-projects-api';

const claude = await Claude.spawn({
    cwd: '/path/to/project',
    model: 'sonnet',
});
const response = await claude.query('Hello!');

await claude.close();
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
