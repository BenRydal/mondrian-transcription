export interface VideoExample {
  id: string
  group: string
  title: string
  duration: string
  videoId: string
  aspect: number
}

const FOUR_THREE = 4 / 3
const WIDE = 16 / 9

const VIDEO_EXAMPLES: readonly VideoExample[] = [
  {
    id: 'example-1',
    group: 'Sports',
    title: "Michael Jordan's Last Shot",
    duration: '37 sec',
    videoId: 'iiMjfVOj8po',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-2',
    group: 'Museums',
    title: 'Single Gallery',
    duration: '8 min',
    videoId: 'pWJ3xNk1Zpg',
    aspect: WIDE,
  },
  {
    id: 'example-3',
    group: 'Classrooms',
    title: '8th Grade Science Lesson',
    duration: '56 min',
    videoId: 'Iu0rxb-xkMk',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-4',
    group: 'Classrooms',
    title: '3rd Grade Discussion Odd/Even Numbers',
    duration: '7 min',
    videoId: 'OJSZCK4GPQY',
    aspect: WIDE,
  },
  {
    id: 'example-5',
    group: 'TIMSS Classroom Video Study',
    title: 'Czech: Density',
    duration: '49 min',
    videoId: 'xrisdnH5GmQ',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-6',
    group: 'TIMSS Classroom Video Study',
    title: 'Japan: Angles',
    duration: '52 min',
    videoId: 'nLDXU2c0vLw',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-7',
    group: 'TIMSS Classroom Video Study',
    title: 'US: Linear Equations',
    duration: '44 min',
    videoId: '5Eg1fJ-ZpQs',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-8',
    group: 'TIMSS Classroom Video Study',
    title: 'US: Rocks',
    duration: '41 min',
    videoId: 'gPb_ST74bpg',
    aspect: FOUR_THREE,
  },
  {
    id: 'example-9',
    group: 'TIMSS Classroom Video Study',
    title: 'Netherlands: Pythagorean Theorem',
    duration: '50 min',
    videoId: 'P5Lxj2nfGzc',
    aspect: FOUR_THREE,
  },
]

export const floorPlanUrl = (example: VideoExample) => `/examples/video/${example.id}.png`

export function groupVideoExamples(examples: readonly VideoExample[] = VIDEO_EXAMPLES) {
  const groups = new Map<string, VideoExample[]>()
  for (const example of examples) {
    groups.set(example.group, [...(groups.get(example.group) ?? []), example])
  }
  return [...groups].map(([group, items]) => ({ group, items }))
}
