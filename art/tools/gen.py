# 调用 Codex 内置 image_gen 生成一张动作条带/特效图。
# 用法：python -I art/tools/gen.py <英雄> <段名> [参考图...]
# 提示词取自 art/heroes/<英雄>/prompts.md 中的 "## common" 与 "## <段名>"（特效段 fx_* 不拼 common）。
# 输出 art/heroes/<英雄>/raw/<段名>-vN.png，并保留 .out 日志。Codex 拒绝时也返回 0，所以以图片是否存在判断成败。
import glob
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def section(text: str, name: str) -> str:
    m = re.search(r'^## ' + re.escape(name) + r'\s*\n+```text\n(.*?)```', text, re.S | re.M)
    if not m:
        raise SystemExit(f'prompts.md 中没有段落 {name}')
    return m.group(1).strip()


def main() -> None:
    hero, name, *refs = sys.argv[1:]
    base = os.path.join(ROOT, 'art', 'heroes', hero)
    text = open(os.path.join(base, 'prompts.md'), encoding='utf8').read()
    prompt = section(text, name) if name.startswith('fx_') else section(text, 'common') + '\n' + section(text, name)
    raw = os.path.join(base, 'raw')
    os.makedirs(raw, exist_ok=True)
    n = 1
    while os.path.exists(os.path.join(raw, f'{name}-v{n}.png')):
        n += 1
    out = os.path.join(raw, f'{name}-v{n}.png')
    codex = sorted(glob.glob(os.path.expandvars(r'%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe')), key=os.path.getmtime)[-1]
    rel = os.path.relpath(out, ROOT).replace('\\', '/')
    instruction = (
        'Use your built-in image_gen tool (not a CLI script). Make ONE 1536x1024 landscape image.\n'
        + prompt
        + f'\nSave the final image to {rel} (copy it from the generated_images folder). Reply only with the saved path.'
    )
    args = [codex, 'exec', '--skip-git-repo-check', '--ephemeral', '-s', 'workspace-write', '-C', ROOT]
    for r in refs:
        args.append('--image=' + os.path.abspath(r))
    # 提示词经 stdin 传入，避免被多值的 --image 参数吞掉
    args.append('-')
    with open(out[:-4] + '.out', 'w', encoding='utf8') as log:
        subprocess.run(args, input=instruction.encode('utf8'), stdout=log, stderr=subprocess.STDOUT, cwd=ROOT, timeout=900)
    if not os.path.exists(out):
        # 有时 Codex 存到了别处，取 generated_images 里最新的一张
        latest = sorted(glob.glob(os.path.expanduser('~/.codex/generated_images/*/*.png')), key=os.path.getmtime)
        if latest and os.path.getmtime(latest[-1]) > os.path.getmtime(out[:-4] + '.out') - 900:
            shutil.copy(latest[-1], out)
    if not os.path.exists(out):
        print('失败：未生成', rel)
        print(open(out[:-4] + '.out', encoding='utf8', errors='replace').read()[-1500:])
        sys.exit(1)
    print(rel)


main()
