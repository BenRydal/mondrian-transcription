<script lang="ts">
  import P5Wrapper from '../lib/p5/P5Wrapper.svelte'
  import Navbar from '$lib/components/nav/Navbar.svelte'
  import PathStats from '$lib/components/PathStats.svelte'

  let p5Component: P5Wrapper

  function handleVideoUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const video = window.document.createElement('video')
      video.src = window.URL.createObjectURL(file)
      video.autoplay = false
      video.loop = false
      p5Component.setVideo(video)
    }
  }

  function handleImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      const image = new window.Image()
      image.src = window.URL.createObjectURL(file)
      image.onload = () => p5Component.setImage(image)
    }
  }

  function handleSavePath(onComplete?: () => void) {
    p5Component.exportAll(onComplete)
  }

  function handleClear() {
    p5Component.clearDrawing()
    p5Component.startNewPath()
  }

  function handleModeSwitch() {
    p5Component.clearDrawing()
    p5Component.clearVideo()
    p5Component.startNewPath()
  }

  function handleNewPath() {
    p5Component.startNewPath()
  }

  function loadExampleData(imageID: string) {
    const filePath = `/examples/${imageID}.png`
    const image = new window.Image()
    image.src = filePath
    image.onload = () => {
      p5Component.setImage(image)
    }
    image.onerror = (error) => {
      window.console.error(`Error loading example image from ${filePath}:`, error)
    }
  }
</script>

<Navbar
  onSelectExample={loadExampleData}
  onImageUpload={handleImageUpload}
  onVideoUpload={handleVideoUpload}
  onSavePath={handleSavePath}
  onClear={handleClear}
  onNewPath={handleNewPath}
  onModeSwitch={handleModeSwitch}
/>
<div class="relative">
  <P5Wrapper bind:this={p5Component} />
  <PathStats />
</div>
