import { Client as MinioClient } from 'minio'
import config from '../config.json' with { type: 'json' }
import { Buffer } from 'buffer'

const { MINIO_CONFIG, BUCKET_NAME } = config

/**
 * Creates and returns a new MinIO client instance.
 * @returns {MinioClient} A Minio client.
 */
export const getMinioClient = () => new MinioClient(MINIO_CONFIG)

/**
 * Ensures that the MinIO bucket exists, creating it if necessary.
 * @param {MinioClient} minioClient - The MinIO client.
 * @returns {Promise<void>}
 */
export const ensureBucketExists = async (minioClient) => {
  const exists = await minioClient.bucketExists(BUCKET_NAME)
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME)
  }
}

/**
 * Retrieves an object from MinIO and returns it as a buffer or string.
 * @param {MinioClient} minioClient - The MinIO client.
 * @param {string} objectName - The name of the object to retrieve.
 * @param {string|null} [encoding=null] - The encoding to use for converting buffer to string. If null, returns a Buffer.
 * @returns {Promise<Buffer|string|null>} The object content, or null if not found.
 */
export const getObjectFromMinio = async (minioClient, objectName, encoding = null) => {
  try {
    const dataStream = await minioClient.getObject(BUCKET_NAME, objectName)
    const chunks = []
    for await (const chunk of dataStream) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    return encoding ? buffer.toString(encoding) : buffer
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return null
    }
    throw error
  }
}

/**
 * Retrieves an object stream from MinIO.
 * @param {MinioClient} minioClient - The MinIO client.
 * @param {string} objectName - The name of the object to retrieve.
 * @returns {Promise<import('stream').Readable|null>} The object stream, or null if not found.
 */
export const getObjectStreamFromMinio = async (minioClient, objectName) => {
  try {
    return await minioClient.getObject(BUCKET_NAME, objectName)
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return null
    }
    throw error
  }
}

/**
 * Puts an object into MinIO with the correct content type.
 * This function is designed to be used within handlers. The handler is responsible for ensuring the bucket exists.
 * @param {MinioClient} minioClient - The MinIO client.
 * @param {string} objectName - The name of the object to store.
 * @param {Buffer|string|object} content - The content of the object.
 * @param {string} type - The type of the object ('pdf', 'txt', 'json', 'png').
 * @returns {Promise<import('minio').UploadedObjectInfo>} The result of the upload.
 */
export const putObjectInMinio = async (minioClient, objectName, content, type) => {
  let buffer
  let contentType

  switch (type) {
    case 'pdf':
      buffer = content // Expects Buffer
      contentType = 'application/pdf'
      break
    case 'txt':
      buffer = Buffer.from(content) // Expects string
      contentType = 'text/plain'
      break
    case 'json':
      buffer = Buffer.from(JSON.stringify(content)) // Expects object
      contentType = 'text/plain'
      break
    case 'png':
      buffer = content // Expects Buffer
      contentType = 'image/png'
      break
    default:
      throw new Error(`Unsupported object type for MinIO upload: ${type}`)
  }

  return minioClient.putObject(BUCKET_NAME, objectName, buffer, {
    'Content-Type': contentType
  })
}

/**
 * Deletes objects from MinIO that match a specific prefix.
 * @param {MinioClient} minioClient - The MinIO client.
 * @param {string} prefix - The prefix to filter objects (e.g., docId).
 * @returns {Promise<void>}
 */
export const deleteObjectsFromMinio = async (minioClient, prefix) => {
  const objectsStream = minioClient.listObjects(BUCKET_NAME, prefix, true)
  const objectNames = []
  for await (const obj of objectsStream) {
    objectNames.push(obj.name)
  }
  if (objectNames.length > 0) {
    await minioClient.removeObjects(BUCKET_NAME, objectNames)
  }
}
