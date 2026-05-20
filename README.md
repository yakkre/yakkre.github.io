# raindrops

A GitHub Pages-friendly personal blog with:

- Register / login
- Google sign-in and email/password sign-in
- Comments
- Likes
- Markdown posts
- Built-in LaTeX using `$$...$$`, `\(...\)`, and `\[...\]`
- Contributor-only post creation
- Firebase Security Rules that enforce writing permissions

## Folder structure

Put these files in the root of your `yakkre.github.io` repository:

```text
yakkre.github.io/
  index.html
  style.css
  app.js
  firebase-config.js
  firestore.rules
  README.md
```

## Firebase setup

1. Go to Firebase Console and create a project.
2. Add a Web app.
3. Copy the `firebaseConfig` object Firebase gives you.
4. Paste it into `firebase-config.js`.
5. In Firebase Authentication, enable:
   - Email/password
   - Google
6. In Firestore Database, create a database.
7. Open Firestore Rules and paste the contents of `firestore.rules`.
8. Publish the rules.

## Owner and contributor access

The owner email is set in `firebase-config.js`:

```js
export const OWNER_EMAIL = "yakuppala10@gmail.com";
```

The owner must log in with this email and verify the email address. After that, the owner can write posts.

To add contributors:

1. Ask the contributor to register/login once.
2. Log in as the owner.
3. Click **Contributors**.
4. Enter the contributor's email.
5. Set their role to `writer`.

Roles:

- `reader`: can read, like, and comment
- `writer`: can create/edit posts
- `admin`: can create/edit posts and manage contributors

## GitHub Pages setup

1. Create a repository named `yakkre.github.io`.
2. Put these files in the repository root.
3. Commit and push to the `main` branch.
4. In GitHub, open the repository settings.
5. Go to **Pages**.
6. Set the source to deploy from the `main` branch and `/root`.

## Writing posts

Posts support Markdown. LaTeX examples:

```md
Inline math: \(a^2+b^2=c^2\)

Display math:

$$
e^{i\pi}+1=0
$$
```

## Important security note

Do not rely on hiding buttons in the website code. The real protection is in `firestore.rules`. Publish those rules before sharing the site.
