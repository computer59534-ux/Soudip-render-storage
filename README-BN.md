# Lover Render Storage

Node.js + Express file hosting API. Uploads require a private API key; uploaded files receive public direct URLs.

## Render-এ deploy

1. ZIP extract করে GitHub repository-তে সব ফাইল upload করুন।
2. Render Dashboard → New → Blueprint নির্বাচন করে repository connect করুন।
3. `render.yaml` থেকে service তৈরি হবে। এখানে **Starter plan + 1 GB Persistent Disk** সেট করা আছে।
4. Deploy শেষ হলে Render service-এর Environment-এ `API_KEY` তৈরি হয়েছে কিনা দেখুন। না থাকলে নিজে অন্তত 32 অক্ষরের random secret দিন।
5. `https://YOUR-SERVICE.onrender.com/health` খুলে `online` দেখুন।

**গুরুত্বপূর্ণ:** Render-এর Persistent Disk paid service plan-এ প্রয়োজন। Free instance-এর local filesystem স্থায়ী নয়। এই ZIP-এর Blueprint-এ Starter plan এবং 1 GB disk দেওয়া আছে। Disk-এর জন্য Render-এর বর্তমান মূল্য/শর্ত Dashboard-এ যাচাই করুন।

## Upload API

- Method: `POST`
- URL: `https://YOUR-SERVICE.onrender.com/api/upload`
- Header: `x-api-key: YOUR_API_KEY`
- Body: `multipart/form-data`
- File field name: `file`

সফল হলে JSON response-এ `url` পাওয়া যাবে। যেমন:
`https://YOUR-SERVICE.onrender.com/file/1730000000000-a1b2c3.mp4`

### cURL test

```bash
curl -X POST "https://YOUR-SERVICE.onrender.com/api/upload" \
  -H "x-api-key: YOUR_API_KEY" \
  -F "file=@/path/to/photo.jpg"
```

## Bot integration (Node.js)

```js
const FormData = require("form-data");
const fs = require("fs");
const axios = require("axios");

async function uploadToLoverStorage(filePath) {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const response = await axios.post(
    "https://YOUR-SERVICE.onrender.com/api/upload",
    form,
    {
      headers: {
        ...form.getHeaders(),
        "x-api-key": process.env.IMAGE_STORAGE_API_KEY
      },
      maxBodyLength: Infinity
    }
  );

  return response.data.url;
}
```

Bot hosting panel-এ `IMAGE_STORAGE_API_KEY` নামে একই API key বসাবেন। Bot-এর কোডে `YOUR-SERVICE`-এর জায়গায় আপনার Render domain দিন।

## নিরাপত্তা ও সীমা

- Upload endpoint API key ছাড়া কাজ করবে না।
- Direct `/file/...` link public; যার কাছে URL থাকবে সে ফাইল দেখতে পারবে।
- Default maximum file size 100 MB; Render Environment-এ `MAX_FILE_MB` বদলাতে পারবেন।
- API key কাউকে দেবেন না এবং GitHub-এ `.env` upload করবেন না।
- এই starter project-এ delete/admin UI নেই।
