export interface VideoExample {
  id: string
  title: string
  duration: string
  videoId: string
  aspect: number
}

const FOUR_THREE = 4 / 3
const WIDE = 16 / 9

export const VIDEO_EXAMPLES: readonly VideoExample[] = [
  {
    id: 'example-1',
    title: "Michael Jordan's Last Shot",
    duration: '37 sec',
    videoId: 'iiMjfVOj8po',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-2',
    title: 'Museum Gallery',
    duration: '8 min',
    videoId: 'pWJ3xNk1Zpg',
    aspect: WIDE,
  },
  {
    id: 'example-3',
    title: '8th Grade Science Lesson',
    duration: '56 min',
    videoId: 'Iu0rxb-xkMk',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-4',
    title: '3rd Grade Discussion',
    duration: '7 min',
    videoId: 'OJSZCK4GPQY',
    aspect: WIDE,
  },
]

export const floorPlanUrl = (example: VideoExample) => `/examples/video/${example.id}.png`
