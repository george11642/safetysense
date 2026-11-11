#!/usr/bin/env python3
"""Make every embedded video in a PPTX start by itself when its slide appears.

pptxgenjs writes click-to-play videos. This adds the timing PowerPoint itself writes for
"Start: Automatically". Usage: autoplay.py deck.pptx [more.pptx ...]
"""
import os, re, subprocess, sys, tempfile, zipfile

def duration_ms(data):
    with tempfile.NamedTemporaryFile(suffix=".mp4") as f:
        f.write(data); f.flush()
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f.name],
                             capture_output=True, text=True).stdout.strip()
    return int(float(out) * 1000) if out else 60000

def timing(spid, ms):
    return (
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        '<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        '<p:par><p:cTn id="5" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect">'
        '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        f'<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="{ms}" fill="hold"/>'
        f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:cmd>'
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
        '</p:childTnLst></p:cTn>'
        '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        '<p:video><p:cMediaNode vol="100000"><p:cTn id="7" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn>'
        f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cMediaNode></p:video>'
        '</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'
    )

def patch(path):
    zin = zipfile.ZipFile(path)
    names = zin.namelist()
    tmp = path + ".tmp"
    done = 0
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            m = re.fullmatch(r"ppt/slides/(slide\d+)\.xml", info.filename)
            if m and b"<a:videoFile" in data and b"<p:timing" not in data:
                xml = data.decode("utf-8")
                pic = re.search(r'<p:pic>\s*<p:nvPicPr>\s*<p:cNvPr id="(\d+)"[^>]*>(?:(?!</p:pic>).)*?<a:videoFile', xml, re.S)
                rels = zin.read(f"ppt/slides/_rels/{m.group(1)}.xml.rels").decode("utf-8")
                media = re.search(r'Target="\.\./media/([^"]+\.(?:mp4|m4v|mov))"', rels)
                ms = duration_ms(zin.read("ppt/media/" + media.group(1))) if media and "ppt/media/" + media.group(1) in names else 60000
                if pic:
                    xml = xml.replace("</p:sld>", timing(pic.group(1), ms) + "</p:sld>")
                    data = xml.encode("utf-8"); done += 1
            zout.writestr(info, data, compress_type=zipfile.ZIP_STORED if info.filename.endswith(".mp4") else zipfile.ZIP_DEFLATED)
    os.replace(tmp, path)
    print(f"{os.path.basename(path)}: autoplay set on {done} video slide(s)")

for p in sys.argv[1:]:
    patch(p)
