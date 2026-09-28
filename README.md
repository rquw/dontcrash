# DON'T CRASH! (web)

## Online leaderboard setup (Firebase, free)

1. Go to https://console.firebase.google.com, **Add project**, any name, analytics off.
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
3. **Build → Realtime Database → Create database**, pick Europe (Belgium), start in **locked mode**.
4. In the database, open the **Rules** tab, paste this and **Publish**:

```json
{
  "rules": {
    "players": {
      ".read": true,
      ".indexOn": ["best"],
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['name', 'best']) && newData.child('name').isString() && newData.child('name').val().length >= 2 && newData.child('name').val().length <= 16 && newData.child('best').isNumber() && newData.child('best').val() >= 0 && newData.child('best').val() < 100000000"
      }
    }
  }
}
```

5. **Project settings (gear) → General → Your apps → Web (</>)**, register an app, copy `apiKey`.
   The database URL is at the top of the Realtime Database page (like `https://yourproject-default-rtdb.europe-west1.firebasedatabase.app`).
6. Put both into `js/online.js`:

```js
export const FIREBASE = {
	apiKey: "AIza...",
	databaseURL: "https://yourproject-default-rtdb.europe-west1.firebasedatabase.app",
};
```

7. `git add . && git commit -m "leaderboard" && git push`

Everyone only ever writes their own entry, the rules make sure of that.
