This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Configure Firebase

The deck and study preference are persisted in [Cloud Firestore](https://firebase.google.com/docs/firestore),
so the app needs a Firebase project to talk to. It's single-user with no sign-in.

1. Create a Firebase project and enable **Cloud Firestore**.
2. Add a **Web app** to the project and copy its `firebaseConfig` values.
3. Copy `.env.example` to `.env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*`
   variables. These are public (they identify the project, not secrets).
4. Set Firestore security rules to allow access to the two documents the app
   uses — `flashcards/deck` and `flashcards/front`. Since there's no auth, the
   simplest workable rule is to allow read/write on that collection, e.g.:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /flashcards/{doc} {
         allow read, write: if true;
       }
     }
   }
   ```

   Tighten this however suits you; just know the client only ever reads/writes
   those two documents.

### Run the dev server

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
