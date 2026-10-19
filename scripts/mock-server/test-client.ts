import ssh2Pkg from 'ssh2'
const { Client } = ssh2Pkg

export async function testSftpAndSsh(): Promise<void> {
  const conn = new Client()

  return new Promise((resolve, reject) => {
    conn
      .on('ready', () => {
        console.log('[TestClient] SSH Connection established successfully!')

        // 1. Test SFTP Directory Listing
        conn.sftp((sftpErr, sftp) => {
          if (sftpErr) {
            conn.end()
            return reject(new Error(`SFTP initialization failed: ${sftpErr.message}`))
          }

          console.log('[TestClient] SFTP Subsystem started successfully. Listing /var/log...')
          sftp.readdir('/var/log', (readErr, list) => {
            if (readErr) {
              conn.end()
              return reject(new Error(`SFTP readdir failed: ${readErr.message}`))
            }

            console.log(
              `[TestClient] SFTP successfully listed ${list.length} items in /var/log:`,
              list.map((item) => item.filename)
            )

            // 2. Test Remote Command Exec (tail -f)
            console.log('[TestClient] Testing remote command tail...')
            let receivedChunks = 0

            conn.exec("tail -n 10 -f '/var/log/app.log'", (execErr, stream) => {
              if (execErr) {
                conn.end()
                return reject(execErr)
              }

              stream.on('data', (data: Buffer) => {
                receivedChunks++
                console.log(
                  `[TestClient] Received tail data chunk #${receivedChunks} (${data.length} bytes)`
                )
                if (receivedChunks >= 3) {
                  console.log('[TestClient] Received sufficient dynamic chunks. Closing connection.')
                  conn.end()
                  resolve()
                }
              })

              stream.stderr.on('data', (data: Buffer) => {
                console.error('[TestClient] Stderr:', data.toString())
              })
            })
          })
        })
      })
      .on('error', (err) => {
        reject(err)
      })
      .connect({
        host: '127.0.0.1',
        port: parseInt(process.argv[2], 10) || 2222,
        username: 'test',
        password: 'password123',
        readyTimeout: 5000
      })
  })
}

testSftpAndSsh()
  .then(() => {
    console.log('[TestClient] SSH & SFTP tests completed successfully.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('[TestClient] Test failed:', err)
    process.exit(1)
  })
