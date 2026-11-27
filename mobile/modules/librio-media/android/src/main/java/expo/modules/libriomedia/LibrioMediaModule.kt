package expo.modules.libriomedia

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import me.zhanghai.android.libarchive.Archive
import me.zhanghai.android.libarchive.ArchiveEntry
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

class LibrioMediaModule : Module() {
  private val jobs = ConcurrentHashMap<String, AtomicBoolean>()
  private val imageExtension = Regex("\\.(jpe?g|png|webp|gif|avif)$", RegexOption.IGNORE_CASE)

  override fun definition() = ModuleDefinition {
    Name("LibrioMedia")

    Function("cancelComic") { jobId: String ->
      jobs[jobId]?.set(true)
      Unit
    }

    AsyncFunction("extractComic") Coroutine { input: String, output: String, coverOnly: Boolean, jobId: String ->
      val cancelled = AtomicBoolean()
      check(jobs.putIfAbsent(jobId, cancelled) == null)
      try {
        withContext(Dispatchers.IO) {
          extractComic(privateFile(input), privateFile(output), coverOnly, cancelled)
        }
      } finally {
        jobs.remove(jobId)
      }
    }

    AsyncFunction("renderPdfCover") Coroutine { input: String, output: String ->
      withContext(Dispatchers.IO) { renderPdfCover(privateFile(input), privateFile(output)) }
    }
  }

  private fun privateFile(uri: String): File {
    val context = checkNotNull(appContext.reactContext)
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file")
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(listOf(context.filesDir, context.cacheDir).any { file.path.startsWith(it.canonicalPath + File.separator) })
    return file
  }

  private fun extractComic(input: File, folder: File, coverOnly: Boolean, cancelled: AtomicBoolean): List<Map<String, Any>> {
    require(folder.isDirectory)
    val archive = Archive.readNew()
    val pages = mutableListOf<Map<String, Any>>()
    val bytes = ByteBuffer.allocateDirect(128 * 1024)
    val chunk = ByteArray(bytes.capacity())
    try {
      Archive.readSupportFormatRar(archive)
      Archive.readSupportFormatRar5(archive)
      Archive.readSupportFormatZip(archive)
      Archive.readOpenFileName(archive, input.path.toByteArray(), bytes.capacity().toLong())

      while (!cancelled.get()) {
        val entry = Archive.readNextHeader(archive)
        if (entry == 0L) break
        val name = ArchiveEntry.pathnameUtf8(entry) ?: ArchiveEntry.pathname(entry)?.decodeToString() ?: continue
        val extension = imageExtension.find(name)?.groupValues?.get(1)?.lowercase() ?: continue
        if (ArchiveEntry.filetype(entry) != ArchiveEntry.AE_IFREG || name.split('/', '\\').any { it == "__MACOSX" || it.startsWith(".") }) continue

        val target = File(folder, "${pages.size + 1}.$extension")
        target.outputStream().buffered().use { stream ->
          while (!cancelled.get()) {
            bytes.clear()
            Archive.readData(archive, bytes)
            val count = bytes.position()
            if (count == 0) break
            bytes.flip()
            bytes.get(chunk, 0, count)
            stream.write(chunk, 0, count)
          }
        }
        if (target.length() == 0L) {
          target.delete()
          continue
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        if (!coverOnly) BitmapFactory.decodeFile(target.path, bounds)
        val aspectRatio = if (bounds.outWidth > 0 && bounds.outHeight > 0) bounds.outWidth.toDouble() / bounds.outHeight else 0.72
        pages.add(mapOf("name" to name, "uri" to Uri.fromFile(target).toString(), "aspectRatio" to aspectRatio))
        if (coverOnly) break
      }

      if (cancelled.get()) return emptyList()
      if (pages.isEmpty()) throw IOException("O arquivo não contém imagens compatíveis.")
      return pages
    } finally {
      Archive.readFree(archive)
    }
  }

  private fun renderPdfCover(input: File, target: File) {
    val descriptor = ParcelFileDescriptor.open(input, ParcelFileDescriptor.MODE_READ_ONLY)
    val renderer = try {
      PdfRenderer(descriptor)
    } catch (error: Exception) {
      descriptor.close()
      throw error
    }
    renderer.use {
      renderer.openPage(0).use { page ->
        val scale = 480.0 / maxOf(page.width, page.height)
        val image = Bitmap.createBitmap(
          maxOf(1, (page.width * scale).roundToInt()),
          maxOf(1, (page.height * scale).roundToInt()),
          Bitmap.Config.ARGB_8888
        )
        try {
          image.eraseColor(Color.WHITE)
          page.render(image, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
          target.outputStream().use { check(image.compress(Bitmap.CompressFormat.JPEG, 85, it)) }
        } finally {
          image.recycle()
        }
      }
    }
  }
}
