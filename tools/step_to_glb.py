"""Convert a STEP assembly (e.g. exported from Autodesk Fusion) into a GLB for the website.

Each top-level component becomes one clickable piece in the website's 3D viewer
(every wheel, rocker, bracket...). Assemblies listed under "expand" in
part_names.json are split one level deeper, and small hardware matching "merge"
is folded into one piece. Display names come from part_names.json, and part
colours from the STEP file are kept.

    pip install cadquery-ocp trimesh scipy
    python tools/step_to_glb.py rover.step assets/model/aanya.glb [--tolerance 0.5]
"""
import argparse
import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

import numpy as np
import trimesh
from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.IFSelect import IFSelect_RetDone
from OCP.Quantity import Quantity_Color
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDF import TDF_Label
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.XCAFDoc import XCAFDoc_ColorGen, XCAFDoc_ColorSurf, XCAFDoc_DocumentTool

try:
    from OCP.TDF import TDF_LabelSequence
except ImportError:  # newer OCP builds
    from OCP.OCP.collections import Sequence_TDF_Label as TDF_LabelSequence

as_face = TopoDS.Face_s if hasattr(TopoDS, "Face_s") else TopoDS.Face


def label_name(label):
    attr = TDataStd_Name()
    if label.FindAttribute(TDataStd_Name.GetID_s(), attr):
        return attr.Get().ToExtString()
    return ""


def base_name(name):
    return re.sub(r":\d+$", "", name).strip()


def shape_to_mesh(shape, tol):
    BRepMesh_IncrementalMesh(shape, tol, False, 0.5, True)
    verts, faces, off = [], [], 0
    exp = TopExp_Explorer(shape, TopAbs_FACE)
    while exp.More():
        face = as_face(exp.Current())
        loc = TopLoc_Location()
        tri = BRep_Tool.Triangulation_s(face, loc)
        if tri is not None:
            trsf = loc.Transformation()
            for i in range(1, tri.NbNodes() + 1):
                p = tri.Node(i).Transformed(trsf)
                verts.append((p.X(), p.Y(), p.Z()))
            rev = face.Orientation() == TopAbs_REVERSED
            for i in range(1, tri.NbTriangles() + 1):
                a, b, c = tri.Triangle(i).Get()
                faces.append((off + a - 1, off + c - 1, off + b - 1) if rev else (off + a - 1, off + b - 1, off + c - 1))
            off += tri.NbNodes()
        exp.Next()
    if not faces:
        return None
    return trimesh.Trimesh(np.array(verts), np.array(faces), process=False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step")
    ap.add_argument("out")
    ap.add_argument("--tolerance", type=float, default=0.5, help="mesh deflection in mm; larger = lighter file")
    ap.add_argument("--names", default=str(Path(__file__).with_name("part_names.json")))
    ap.add_argument("--z-up", action="store_true", help="source is Z-up (Fusion STEP exports are Y-up by default)")
    args = ap.parse_args()

    cfg = json.loads(Path(args.names).read_text(encoding="utf-8")) if Path(args.names).exists() else {}
    rename = [(re.compile(k, re.I), v) for k, v in cfg.get("rename", {}).items()]
    merge = [(re.compile(k, re.I), v) for k, v in cfg.get("merge", {}).items()]
    expand = [re.compile(p, re.I) for p in cfg.get("expand", [])]

    def display(name):
        for rx, v in rename:
            if rx.search(name):
                return v
        return base_name(name) or "Part"

    doc = TDocStd_Document(TCollection_ExtendedString("doc"))
    reader = STEPCAFControl_Reader()
    reader.SetNameMode(True)
    reader.SetColorMode(True)
    if reader.ReadFile(args.step) != IFSelect_RetDone:
        sys.exit("Could not read STEP file")
    reader.Transfer(doc)
    shapes = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    colors = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())

    def color_of(labels, shape):
        c = Quantity_Color()
        by_label = getattr(type(colors), "GetColor_s", None)
        for kind in (XCAFDoc_ColorSurf, XCAFDoc_ColorGen):
            for lab in labels:
                try:
                    if by_label and by_label(lab, kind, c):
                        return [int(c.Red() * 255), int(c.Green() * 255), int(c.Blue() * 255), 255]
                except TypeError:
                    pass
            if colors.GetColor(shape, kind, c):
                return [int(c.Red() * 255), int(c.Green() * 255), int(c.Blue() * 255), 255]
        return None

    pieces = OrderedDict()  # piece id -> (display name, [meshes])

    def piece_for(path):
        top = path[0] if path else "Part"
        if len(path) > 1 and any(rx.search(top) for rx in expand):
            sub = path[1]
            for rx, v in merge:
                if rx.search(sub):
                    return f"{top}/{v}", v
            return f"{top}/{sub}", display(sub)
        return top, display(top)

    def walk(label, loc, path, inherited):
        name = label_name(label)
        if shapes.IsReference_s(label):
            ref = TDF_Label()
            shapes.GetReferredShape_s(label, ref)
            inst = name if name and not name.startswith("=>") else (label_name(ref) or name)
            walk(ref, loc.Multiplied(shapes.GetLocation_s(label)), path + [inst], [label, ref] + inherited)
            return
        if shapes.IsAssembly_s(label):
            kids = TDF_LabelSequence()
            shapes.GetComponents_s(label, kids)
            for i in range(1, kids.Length() + 1):
                walk(kids.Value(i), loc, path, inherited)
            return
        shape = shapes.GetShape_s(label)
        mesh = shape_to_mesh(shape.Moved(loc), args.tolerance)
        if mesh is None:
            return
        mesh.visual.face_colors = color_of([label] + inherited, shape) or [140, 146, 154, 255]
        pid, disp = piece_for(path)
        pieces.setdefault(pid, (disp, []))[1].append(mesh)

    roots = TDF_LabelSequence()
    shapes.GetFreeShapes(roots)
    for i in range(1, roots.Length() + 1):
        root = roots.Value(i)
        if shapes.IsAssembly_s(root):
            kids = TDF_LabelSequence()
            shapes.GetComponents_s(root, kids)
            for j in range(1, kids.Length() + 1):
                walk(kids.Value(j), TopLoc_Location(), [], [])
        else:
            walk(root, TopLoc_Location(), [label_name(root)], [])

    scene = trimesh.Scene()
    seen, tris = {}, 0
    for pid, (disp, meshes) in pieces.items():
        # Vertices stay split per CAD face, so normals are smooth within a face and
        # crisp along its edges.
        mesh = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
        _ = mesh.vertex_normals
        seen[disp] = seen.get(disp, 0) + 1
        node = disp if seen[disp] == 1 else f"{disp} ({seen[disp]})"
        scene.add_geometry(mesh, node_name=node, geom_name=node)
        tris += len(mesh.faces)

    # STEP is in millimetres; the web viewer wants metres, Y-up.
    if args.z_up:
        scene.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    scene.apply_scale(0.001)
    scene.export(args.out, include_normals=True)
    kinds = sorted(set(d for d, _ in pieces.values()))
    print(f"{len(pieces)} pieces, {len(kinds)} kinds, {tris:,} triangles -> {args.out}")
    print("kinds:", ", ".join(kinds))


if __name__ == "__main__":
    main()
