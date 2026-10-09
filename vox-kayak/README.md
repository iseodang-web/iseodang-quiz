# Vox 스타일 종이 컷아웃 카약 루프

1. `prompts.md` 대로 힉스필드에서 5장 생성 → `frames/frame_1~5.png` 저장
2. 의존성: `pip install pillow numpy` + `ffmpeg`
3. 실행
```bash
python make_loop.py --frames frames --out kayak_loop.mp4 --seconds 6
```
| 옵션 | 설명 | 기본값 |
|---|---|---|
| `--hold` | 그림 1장 유지 프레임 수 (클수록 느리고 투박) | 3 |
| `--pingpong` | 1-2-3-4-5-4-3-2 왕복 | 꺼짐 |
| `--shift` / `--rot` | 종이 떨림 강도 | 3px / 0.25° |
| `--grain` | 종이 질감 노이즈 | 7 |

테스트: `python make_placeholders.py` 로 임시 프레임 5장을 만들어 파이프라인만 확인할 수 있습니다.
