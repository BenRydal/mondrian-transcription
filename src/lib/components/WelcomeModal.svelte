<script lang="ts">
  import IconPlayArrow from '~icons/material-symbols/play-arrow'
  import IconClick from '~icons/material-symbols/touch-app'
  import IconKeyboard from '~icons/material-symbols/keyboard'
  import IconUpload from '~icons/material-symbols/upload'
  import IconDownload from '~icons/material-symbols/download'
  import IconScience from '~icons/material-symbols/science'
  // Same mark the History panel and the recovery modal use.
  import IconHistory from '~icons/material-symbols/history'
  import IconShieldLock from '~icons/material-symbols/shield-lock-outline'
  import IconCite from '~icons/material-symbols/school-outline'
  // material-symbols has no brand marks, so the GitHub logo comes from mdi.
  import IconGithub from '~icons/mdi/github'

  const CITATION =
    'Shapiro, B. R., Silvis, D., & Hall, R. (2025). Visualization as theory and experience: interactive qualitative data visualization for the learning sciences. Journal of the Learning Sciences, 34(5), 840–871.'

  export let onClose: () => void
  export let onTryExample: (() => void) | undefined = undefined
</script>

<dialog id="welcome_modal" class="modal" data-ui-element>
  <div class="modal-box w-11/12 max-w-6xl max-h-[90vh] p-0 overflow-y-auto">
    <!-- Main content: split layout -->
    <div class="flex flex-col md:flex-row min-h-[580px]">
      <!-- Left: GIF -->
      <div class="md:w-1/2 bg-white flex items-center justify-center p-5 border-r border-base-200">
        <img
          src="/cover.gif"
          alt="Mondrian in action - tracing movement paths over a floor plan synchronized to video"
          class="w-full h-full object-contain max-h-[340px] md:max-h-none rounded-lg"
        />
      </div>

      <!-- Right: Quick Start -->
      <div class="md:w-1/2 p-8 md:p-10 flex flex-col">
        <!-- Header -->
        <div class="mb-6">
          <h2 class="text-3xl md:text-4xl font-bold mb-2">Mondrian</h2>
          <p class="text-base-content/70 text-lg">
            Transcribe movement from video into position data
          </p>
        </div>

        <!-- Quick Start Steps -->
        <div class="space-y-4 flex-1">
          <div class="flex gap-4 items-start">
            <div
              class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
            >
              <IconUpload class="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 class="font-semibold">Upload your files</h4>
              <p class="text-base-content/60">
                Load a floor plan image and video (or just floor plan for Speculate mode)
              </p>
            </div>
          </div>

          <div class="flex gap-4 items-start">
            <div
              class="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0"
            >
              <IconClick class="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h4 class="font-semibold">Click to record paths</h4>
              <p class="text-base-content/60">
                Click to start tracing, click to pause. Record multiple paths with different colors.
              </p>
            </div>
          </div>

          <div class="flex gap-4 items-start">
            <div
              class="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0"
            >
              <IconKeyboard class="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 class="font-semibold">Keyboard shortcuts</h4>
              <p class="text-base-content/60">
                <kbd class="kbd kbd-sm">F</kbd> forward, <kbd class="kbd kbd-sm">R</kbd> rewind through
                video and recording
              </p>
            </div>
          </div>

          <div class="flex gap-4 items-start">
            <div
              class="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0"
            >
              <IconDownload class="w-5 h-5 text-info" />
            </div>
            <div>
              <h4 class="font-semibold">Export your data</h4>
              <p class="text-base-content/60">
                Download a ZIP with CSV files for each path and your floor plan image
              </p>
            </div>
          </div>
        </div>

        <!-- Auto-backup note. The privacy claim itself lives in the footer. -->
        <div
          class="flex items-center gap-2 text-sm text-green-700 mt-5 pt-4 border-t border-base-200"
        >
          <IconHistory class="w-5 h-5 flex-shrink-0" />
          <span>Auto-backup saves your work locally in case of errors.</span>
        </div>

        <!-- Footer actions -->
        <div class="flex items-center justify-between pt-5 mt-4">
          <a
            href="https://youtu.be/mgbNzikyucQ"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost gap-2"
          >
            <IconPlayArrow class="w-5 h-5" />
            Demo
          </a>
          <div class="flex gap-2">
            {#if onTryExample}
              <button class="btn btn-outline gap-2" on:click={onTryExample}>
                <IconScience class="w-5 h-5" />
                Try Example
              </button>
            {/if}
            <button class="btn btn-primary" on:click={onClose}> Get Started </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-base-300 bg-base-200/50 px-4 py-3 text-sm text-base-content/50">
      <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <!-- Same green as the auto-backup note above, on both icon and text. -->
        <span
          class="flex items-center gap-1.5 text-green-700"
          title="Your data never leaves your device"
        >
          <IconShieldLock class="text-base" /> 100% private, runs in your browser
        </span>
        <span aria-hidden="true">•</span>
        <a
          href="https://github.com/BenRydal/mondrian-transcription"
          target="_blank"
          title="GPL v3"
          class="flex items-center gap-1.5 hover:underline"
        >
          <IconGithub class="text-base" /> Open source
        </a>
        <span aria-hidden="true">•</span>
        <a
          href="https://doi.org/10.1080/10508406.2025.2537945"
          target="_blank"
          title={CITATION}
          class="flex items-center gap-1.5 hover:underline"
        >
          <IconCite class="text-base" /> Cite
        </a>
      </div>
      <p class="text-center text-base-content/70 mt-3">
        Designed by
        <a href="https://www.benrydal.com" target="_blank" class="hover:underline"
          >Ben Rydal Shapiro</a
        >
        and
        <a href="https://www.edwinzhao.com" target="_blank" class="hover:underline">Edwin Zhao</a>
      </p>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button on:click={onClose}>close</button>
  </form>
</dialog>
