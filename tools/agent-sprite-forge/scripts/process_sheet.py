#!/usr/bin/env python3
from PIL import Image
from pathlib import Path
import argparse,json

def split_grid(im,cols,rows):
    w,h=im.size
    cells=[]
    for r in range(rows):
        y0,y1=round(r*h/rows),round((r+1)*h/rows)
        for c in range(cols):
            x0,x1=round(c*w/cols),round((c+1)*w/cols)
            cells.append(im.crop((x0,y0,x1,y1)))
    return cells

def normalize(cell,size,fit=.90):
    bbox=cell.getchannel('A').getbbox(); out=Image.new('RGBA',(size,size),(0,0,0,0))
    if not bbox:return out
    crop=cell.crop(bbox); scale=min(size*fit/crop.width,size*fit/crop.height)
    crop=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.NEAREST)
    x=(size-crop.width)//2; y=size-crop.height-1
    out.alpha_composite(crop,(x,y)); return out

def main():
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('output');p.add_argument('--cols',type=int,required=True);p.add_argument('--rows',type=int,required=True);p.add_argument('--size',type=int,required=True);p.add_argument('--layout',required=True,help='comma separated action:start:count, e.g. walk:0:8,shoot:8:6,death:16:7');p.add_argument('--id',default='sprite');p.add_argument('--segment-size',type=int,default=0)
    a=p.parse_args(); out=Path(a.output);out.mkdir(parents=True,exist_ok=True);cells=split_grid(Image.open(a.input).convert('RGBA'),a.cols,a.rows); animations={}
    for chunk in a.layout.split(','):
        action,start,count=chunk.split(':');start=int(start);count=int(count);frames=[normalize(cells[start+n],a.size) for n in range(count)];segsize=a.segment_size or count;defs=[]
        for offset in range(0,count,segsize):
            batch=frames[offset:offset+segsize];sheet=Image.new('RGBA',(len(batch)*a.size,a.size),(0,0,0,0))
            for n,fr in enumerate(batch):sheet.alpha_composite(fr,(n*a.size,0))
            suffix='' if count<=segsize else f'_{offset//segsize}'
            fn=f'{action}{suffix}.png';sheet.save(out/fn,optimize=True);defs.append({'file':fn,'count':len(batch)})
        animations[action]={'segments':defs,'count':count,'fps':8,'loop':True}
    (out/'metadata.json').write_text(json.dumps({'id':a.id,'frameSize':a.size,'pivot':[.5,1.0],'animations':animations},indent=2))
if __name__=='__main__':main()
