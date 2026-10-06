# zijian-site-tests

Functional tests for [zijian-site](https://github.com/ZiJian226/zijian-site), written from `SPEC.md` only.
Playwright + TypeScript, Chromium only. Tests run against a live URL given by `BASE_URL`.

## Run

```
npm ci
npx playwright install chromium
BASE_URL=http://localhost:8000 npm test
```

`BASE_URL` may include a path, e.g. `https://zijian226.github.io/zijian-site/`.
