"""Blender script: export the low-poly game mannequin from 3DMannequin.blend to assets/mannequin.glb.

Run inside Blender (Scripting tab, or `blender 3DMannequin.blend --background --python tools/export_mannequin.py`).
It duplicates the 'Mannequin' mesh, drops subdivision/geometry-node modifiers, decimates it to
~2.2k verts (keeping skin weights) and exports it with the 'Armature Mannequin.001' rig in rest pose.
The .blend itself is left untouched (the temporary object is deleted afterwards).
"""
import bpy, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if "__file__" in globals() else bpy.path.abspath("//")
OUT = os.path.join(ROOT, "assets", "mannequin.glb")

src = bpy.data.objects["Mannequin"]
arm = bpy.data.objects["Armature Mannequin.001"]
body = src.copy(); body.data = src.data.copy(); body.name = "Body"
bpy.context.scene.collection.objects.link(body)
for m in list(body.modifiers):
    if m.type != "ARMATURE":
        body.modifiers.remove(m)
dec = body.modifiers.new("dec", "DECIMATE"); dec.ratio = 0.22
for o in bpy.context.selected_objects:
    o.select_set(False)
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
bpy.ops.object.modifier_apply(modifier="dec")
body.data.materials.clear()
body.data.materials.append(bpy.data.materials.new("Skin"))

arm.select_set(True)
bpy.context.view_layer.objects.active = arm
prev = arm.data.pose_position
arm.data.pose_position = "REST"
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_animations=False, export_apply=False, export_skins=True, export_normals=True)
arm.data.pose_position = prev

me = body.data
bpy.data.objects.remove(body, do_unlink=True)
if me.users == 0:
    bpy.data.meshes.remove(me)
print("exported", OUT)
