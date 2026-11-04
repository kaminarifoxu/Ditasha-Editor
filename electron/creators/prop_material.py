"""Extract common glTF Base Color material semantics from Blender nodes.

Keep materials and images separate. Unsupported node graphs fail closed rather
than silently replacing a colorful source with a white placeholder.
"""
import math


def _rgba(value):
    result = tuple(float(n) for n in value)
    if len(result) == 3:
        result = (*result, 1.0)
    if len(result) != 4 or not all(math.isfinite(n) for n in result):
        raise ValueError("Invalid source material base color")
    return result


def _mul(a, b):
    return tuple(a[i] * b[i] for i in range(4))


def _compose(left, right):
    a_img, a_color = left
    b_img, b_color = right
    if a_img is not None and b_img is not None:
        raise ValueError("Multiple image sources in Base Color require baking")
    return a_img if a_img is not None else b_img, _mul(a_color, b_color)


def _socket_value(socket, depth=0):
    if depth > 8:
        raise ValueError("Material node graph is too deeply nested")
    if not socket.is_linked:
        return None, _rgba(socket.default_value)
    links = list(socket.links)
    if len(links) != 1:
        raise ValueError("Ambiguous Base Color node connections")
    link = links[0]
    node = link.from_node
    if node.type == "TEX_IMAGE":
        if node.image is None:
            raise ValueError("Base Color image is missing")
        return node.image, (1.0, 1.0, 1.0, 1.0)
    if node.type == "RGB":
        return None, _rgba(link.from_socket.default_value)
    if node.type == "REROUTE":
        return _socket_value(node.inputs[0], depth + 1)
    if node.type == "MIX_RGB" and node.blend_type == "MULTIPLY":
        fac = node.inputs[0]
        if fac.is_linked:
            raise ValueError("Dynamic glTF Base Color factor requires baking")
        strength = float(fac.default_value)
        if not math.isfinite(strength) or strength < 0 or strength > 1:
            raise ValueError("Invalid Base Color multiplier")
        left = _socket_value(node.inputs[1], depth + 1)
        right = _socket_value(node.inputs[2], depth + 1)
        # MixRGB multiply: L * (1 - fac + fac * R).
        # A single textured side can be evaluated without baking; the other
        # must be a constant RGBA factor. For other arrangements, fail closed.
        if right[0] is not None:
            if left[0] is not None:
                raise ValueError("Multiple Base Color image sources require baking")
            if strength != 1.0:
                raise ValueError("Partial dynamic Base Color mix requires baking")
            return _compose(left, right)
        effective = tuple(1 - strength + strength * v for v in right[1])
        return _compose(left, (None, effective))
    raise ValueError(
        "Unsupported Base Color node '%s'; bake material to a diffuse image"
        % node.type
    )


def material_diffuse_spec(material):
    """Return (Blender Image | None, linear-RGBA tint) for common glTF materials."""
    if material is None:
        return None, (1.0, 1.0, 1.0, 1.0)
    if not material.use_nodes or material.node_tree is None:
        return None, _rgba(material.diffuse_color)
    nodes = [n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"]
    if len(nodes) != 1:
        raise ValueError(
            "Material '%s' needs a single Principled BSDF or baked diffuse image"
            % material.name
        )
    bsdf = nodes[0]
    base = bsdf.inputs.get("Base Color")
    if base is None:
        raise ValueError("Principled BSDF missing Base Color")
    image, color = _socket_value(base)
    alpha = bsdf.inputs.get("Alpha")
    if alpha is not None:
        if alpha.is_linked:
            # Standard glTF links the alpha of the SAME base-color image.
            links = list(alpha.links)
            if image is None or len(links) != 1 or links[0].from_node.type != "TEX_IMAGE" or links[0].from_node.image != image:
                raise ValueError("Complex alpha material requires texture baking")
        else:
            color = (*color[:3], color[3] * float(alpha.default_value))
    if not all(math.isfinite(v) and 0 <= v <= 1 for v in color):
        raise ValueError("Base Color factor outside supported 0..1 range")
    return image, color
