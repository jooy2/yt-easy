<!--
Thank you for contributing to the project. Your contribution will be reviewed and approved after appropriate review.

Please read the caveats below to ensure a fast merge.
-->

## Pull request checklist

You should familiarize yourself with the files `README.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` in the root of your project.

- If an issue has been created for this, add `(fixes #{ISSUE_NUMBER})` to the end of the commit description. In `{ISSUE_NUMBER}`, please include the relevant issue number.
- Run `npm run build` and `npm test`, and make sure both succeed.
- Load the extension unpacked and try the change on the Watch later page. Say in the description what you tried.
- Keep YouTube-specific selectors, data keys, and menu labels in `src/content/selectors.js`.
- Do not add a package or a permission without explaining why in the description, and do not commit `dist/`.
- Removal must stay at a person's pace, and the extension must not read anything beyond your own Watch later list.
- If this PR is not yet complete, keep the PR in draft status. If it's no longer valid, close the PR with an explanation.

<!--
Below is a template for describing this PR. It's not required, so please delete the content below if you don't need it.
-->

### What did you change?

### Why is the change needed?

### How did you test it?
