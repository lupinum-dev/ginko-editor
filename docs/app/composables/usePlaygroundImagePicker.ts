import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import type { EditorImage, ImagePicker } from '@lupinum/ginko-editor'
import type { EditorImagePickerItem } from '@lupinum/ginko-editor'

export function usePlaygroundImagePicker(images: Ref<EditorImagePickerItem[]>) {
  const imageLibraryOpen = ref(false)
  const imageQuery = ref('')

  const finishImageChoice = ref<((image: EditorImage | null) => void) | undefined>(undefined)

  const imageChoices = computed(() => {
    const query = imageQuery.value.trim().toLocaleLowerCase()

    if (!query) {
      return images.value
    }

    return images.value.filter(image =>
      image.label.toLocaleLowerCase().includes(query),
    )
  })

  const imagePicker: ImagePicker = ({ signal }) =>
    new Promise((resolve) => {
      finishImageChoice.value?.(null)

      if (signal.aborted) {
        resolve(null)
        return
      }

      function finish(image: EditorImage | null) {
        signal.removeEventListener('abort', abort)

        finishImageChoice.value = undefined
        imageLibraryOpen.value = false

        resolve(image)
      }

      function abort() {
        finish(null)
      }

      finishImageChoice.value = finish

      imageQuery.value = ''
      imageLibraryOpen.value = true

      signal.addEventListener('abort', abort, { once: true })
    })

  onBeforeUnmount(() => {
    finishImageChoice.value?.(null)
  })

  return {
    imagePicker,
    imageLibraryOpen,
    imageQuery,
    imageChoices,
    finishImageChoice,
  }
}
