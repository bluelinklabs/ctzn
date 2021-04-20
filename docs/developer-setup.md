# Developer setup

If you're working from the Git repo, here are some tips for setting up the server.

## Admin UI

The admin UI relies on Tailwinds CSS. The production build of the tailwind .css is included in the npm package, but the development build is not included in the git repo, so you'll need to generate the development .css file by running:

```
npm run tailwind-dev
```

When you run `npm publish`, the production version of the tailwind .css will be generated. After publish, the dev version will be regenerated.

Note: it's possible for the production build of tailwind to miss some of the classes. You can test the production .css bundle by running:

```
npm run tailwind-prod
```