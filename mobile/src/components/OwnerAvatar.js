import React, { useEffect, useState } from "react";
import { View, Image, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SvgXml } from "react-native-svg";
import { resolveMediaUrl } from "../services/api";
import { fonts, colors } from "../theme";

function isSvgUrl(url) {
  return /\.svg(\?|#|$)/i.test(String(url || ""));
}

/** react-native-svg non legge i <style> CSS: inline fill/stroke sulle classi. */
function prepareSvgForNative(svgText) {
  if (!svgText) return "";
  let out = String(svgText);

  const styleBlock = out.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleBlock) {
    const rules = styleBlock[1];
    const re = /\.([a-z0-9_-]+)\s*\{([^}]+)\}/gi;
    let m;
    while ((m = re.exec(rules)) !== null) {
      const className = m[1];
      const decls = m[2];
      const fill = decls.match(/fill:\s*([^;}\s]+)/i)?.[1]?.replace(/['"]/g, "");
      const stroke = decls.match(/stroke:\s*([^;}\s]+)/i)?.[1]?.replace(/['"]/g, "");
      const strokeWidth = decls.match(/stroke-width:\s*([^;}\s]+)/i)?.[1];
      const attrs = [
        fill ? `fill="${fill}"` : "",
        stroke ? `stroke="${stroke}"` : "",
        strokeWidth ? `stroke-width="${strokeWidth}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (!attrs) continue;
      out = out.replace(new RegExp(`class=["']${className}["']`, "g"), attrs);
    }
    out = out.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  }

  if (!/viewBox=/i.test(out)) {
    out = out.replace(/<svg\b/i, '<svg viewBox="0 0 100 100"');
  }

  out = out.replace(/\s(width|height)=["'][^"']*["']/gi, "");

  return out;
}

function RemoteSvgAvatar({ uri, size, onError }) {
  const [xml, setXml] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setXml(null);

    fetch(uri)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((raw) => {
        if (cancelled) return;
        const prepared = prepareSvgForNative(raw);
        if (!prepared.includes("<svg")) throw new Error("invalid svg");
        setXml(prepared);
      })
      .catch(() => {
        if (!cancelled) onError?.();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uri, onError]);

  if (loading) {
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color={colors.slateGray} />
      </View>
    );
  }

  if (!xml) return null;

  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      onError={() => onError?.()}
    />
  );
}

/** Avatar utente: PNG/JPG con Image, SVG con fetch+SvgXml, altrimenti iniziale. */
export default function OwnerAvatar({ avatarUrl, name, size = 24, style }) {
  const uri = avatarUrl ? resolveMediaUrl(avatarUrl) : null;
  const initial = (name || "P").trim().slice(0, 1).toUpperCase();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [uri]);

  const boxStyle = [
    styles.box,
    { width: size, height: size, borderRadius: size / 2, minWidth: size, minHeight: size },
    style,
  ];

  if (uri && !loadFailed && isSvgUrl(uri)) {
    return (
      <View style={[boxStyle, styles.svgBox]}>
        <RemoteSvgAvatar uri={uri} size={size} onError={() => setLoadFailed(true)} />
      </View>
    );
  }

  if (uri && !loadFailed && !isSvgUrl(uri)) {
    return (
      <Image
        key={uri}
        source={{ uri }}
        style={[styles.image, boxStyle]}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <View style={[boxStyle, styles.initial]}>
      <Text style={[styles.initialText, { fontSize: Math.max(10, size * 0.42) }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  svgBox: {
    backgroundColor: "#ffffff",
  },
  image: {
    backgroundColor: "#eee",
  },
  initial: {
    backgroundColor: colors.divider,
  },
  initialText: {
    fontFamily: fonts.bold,
    color: colors.slateGray,
  },
});
