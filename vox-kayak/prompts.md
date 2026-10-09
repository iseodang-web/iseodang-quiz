# 힉스필드 프롬프트 (카약 노 젓기 5컷)

## 사용 순서
1. 레퍼런스 이미지(찢어진 종이 콜라주)를 **Image reference**로 첨부 (모델: GPT Image 2.5 권장, 비율 4:5)
2. **프레임 1을 먼저 생성** → 마음에 드는 1장을 확정
3. 프레임 2~5는 *확정한 프레임 1을 레퍼런스로 함께 첨부*해서 생성 (동일 스타일·구도 유지의 핵심)
4. 결과를 `frames/frame_1.png ~ frame_5.png` 로 저장

## 공통 스타일 블록 (모든 프롬프트 앞에 붙이기)
```
Vox-style torn paper collage illustration. Every element is hand-torn paper with rough white fibrous torn edges and visible paper grain: the turquoise-teal sea background made of layered torn paper sheets, the kayak, the paddler, the paddle, the water ripples. Flat gouache-like colors, subtle drop shadows between paper layers, no outlines, no gradients, no 3D render. Fixed camera, identical composition and scale in every frame: top-down three-quarter view, a single kayaker centered in the lower-middle of a 4:5 vertical frame, orange-red kayak, yellow life jacket, black hair, wooden paddle. Only the paddle and arms change between frames.
```

## 프레임별 동작 (노 젓기 한 사이클)
| 프레임 | 동작 | 프롬프트 뒤에 붙일 문장 |
|---|---|---|
| 1 | 왼쪽 준비 | `Pose 1/5: paddle tilted with the left blade dipping into the water at the front-left, right arm raised high, torso leaning slightly left.` |
| 2 | 왼쪽 당기기 | `Pose 2/5: left blade pulled back alongside the hull, paddle nearly parallel to the kayak, torso twisted left, small paper water-splash shapes at the blade.` |
| 3 | 중립(들어올림) | `Pose 3/5: paddle held level across the body above the water, both arms extended evenly, torso upright.` |
| 4 | 오른쪽 준비 | `Pose 4/5: paddle tilted with the right blade dipping into the water at the front-right, left arm raised high, torso leaning slightly right.` |
| 5 | 오른쪽 당기기 | `Pose 5/5: right blade pulled back alongside the hull, torso twisted right, small paper water-splash shapes at the blade.` |

> 재생 순서 1→2→3→4→5→1… 로 반복하면 좌우 노 젓기가 자연스럽게 이어집니다.
> 프레임 5 → 1 연결이 어색하면 `--pingpong` 옵션을 쓰세요.

## 자주 하는 실수
- 프레임마다 카약 위치·크기가 달라짐 → 확정한 프레임 1을 항상 레퍼런스로 첨부
- 사진처럼 매끈해짐 → 스타일 블록에 `no 3D render, no gradients` 유지
- 배경 종이 조각 배치가 매번 바뀜 → `identical background paper layout` 문장 추가
