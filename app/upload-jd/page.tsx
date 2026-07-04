'use client'

import { useState } from 'react'

export default function UploadJDPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file) {
      alert('Please choose a JD file')
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/parse-jd', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      setResult(data)

      alert('JD Parsed Successfully')
    } catch (error) {
      console.error(error)
      alert('Failed to parse JD')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#18245c] text-white p-10">
      <div className="max-w-5xl mx-auto bg-black/30 p-10 rounded-3xl">
        <h1 className="text-6xl font-bold mb-10">
          Upload Job Description
        </h1>

        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              setFile(e.target.files[0])
            }
          }}
          className="mb-6 text-xl"
        />

        <br />

        <button
          onClick={handleUpload}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 transition px-8 py-4 rounded-2xl text-2xl font-semibold"
        >
          {loading ? 'Parsing JD...' : 'Parse JD'}
        </button>
      </div>

      {result && (
        <div className="max-w-5xl mx-auto bg-black/30 p-10 rounded-3xl mt-10">
          <h2 className="text-5xl font-bold mb-8">
            Parsed JD Result
          </h2>

          <pre className="text-xl whitespace-pre-wrap overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}