"use strict";
// Leaflet Control

class Leaflet {

    constructor() {
        this.map;
        this.Control = { "locate": "", "maps": "" };    // leaflet object
        this.popup = null;
    };

    init() {

        return new Promise((resolve, reject) => {
            let def = Conf.default;
            let maps = {}, tiles = {};
            Object.keys(Conf.tile).forEach(key => {
                let params = { "attribution": Conf.tile[key].copyright, "maxZoom": def.maxZoom };
                if (Conf.tile[key].maxNativeZoom !== void 0) params.maxNativeZoom = Conf.tile[key].maxNativeZoom;
                if (Conf.tile[key].filter !== void 0) {             // color filter
                    params.filter = Conf.tile[key].filter;
                    tiles[key] = L.tileLayer.colorFilter(Conf.tile[key].url, params);
                } else if (Conf.tile[key].style !== void 0) {       // vector tile
                    params.style = Conf.tile[key].style;
                    params.accessToken = '';
                    tiles[key] = L.maplibreGL(params);
                } else {                                            // normal tile
                    tiles[key] = L.tileLayer(Conf.tile[key].url, params);
                }
                maps[Conf.tile[key].name] = tiles[key];
            });
            let deftile = navigator.userAgent.indexOf("FB") > 0 ? tiles[Conf.tile_select.Facebook_Builtin] : tiles[Conf.tile_select.default]; // facebook対策(内蔵ブラウザだとMaptilerが出ない)
            let params = {
                "maxZoom": def.maxZoom, "minZoom": (basic.isSmartPhone() ? def.phone_minZoom : def.pc_minZoom),
                doubleClickZoom: false, zoomSnap: def.zoomSnap, zoomDelta: def.zoomSnap, layers: [deftile],
                maxBounds: def.maxbounds
            };
            this.map = L.map('mapid', params);
            new L.Hash(this.map);
            this.Control["maps"] = L.control.layers(maps, null, { position: 'bottomright' }).addTo(this.map);
            this.map.zoomControl.setPosition("bottomright");
            this.map.on('load', resolve);
            let lhash = L.Hash.parseHash(location.hash);
            if (def.keep_view || lhash == false) {
                this.map.setView(def.default_view, def.initZoom);   // setView is the last
            } else {
                this.map.setView(lhash.center, lhash.zoom);
            }
        });

    };

    enable(flag) {
        if (flag) {
            this.map.scrollWheelZoom.enable();
            this.map.dragging.enable();
        } else {
            this.map.scrollWheelZoom.disable();
            this.map.dragging.disable();
        }
    };

    start() {
        ["dragging", "touchZoom"].forEach(key => map[key].enable());
        this.Control["maps"].addTo(map);
        this.Control["locate"].addTo(map);
        this.map.zoomControl.addTo(map);
        if (this.map.tap) this.map.tap.enable();
        document.getElementById('mapid').style.cursor = 'grab';
    };

    stop() {
        ["dragging", "touchZoom"].forEach(key => map[key].disable());
        this.Control["maps"].remove(map);
        this.Control["locate"].remove(map);
        this.map.zoomControl.remove(map);
        if (this.map.tap) this.map.tap.disable();
        document.getElementById('mapid').style.cursor = 'default';
    };

    on(event, callback) {
        this.map.on(event, callback);
    };

    // Marker追加(poiMarkerから呼ばれる) return:maker
    addMarker(params) {
        let icon = L.divIcon({
            "className": "", "iconSize": [params.size + params.span_width, params.size],
            "iconAnchor": [params.size / 2, params.size / 2], "html": params.html + "</div>"
        });
        let marker = L.marker(new L.LatLng(params.poi.latlng[0], params.poi.latlng[1]), { icon: icon, draggable: false, zIndexOffset: params.zIndexOffset });
        marker.addTo(this.map); //.on('click', e => { cMapmaker.viewDetail(e.target.mapmaker_id) });
        marker.mapmaker_id = params.poi.geojson.id;
        marker.mapmaker_key = params.target;
        marker.mapmaker_lang = params.langname;
        return marker;
    };

    // マーカーを消す処理
    delMaker(marker) {
        if (marker == undefined) return;
        if (marker.length == undefined) { this.map.removeLayer(marker); return };
        marker.forEach(m => this.map.removeLayer(m));   // 子要素がある場合を想定
    };

    openPopup(marker, params) {
        if (this.popup !== null) this.popup.close();
        setTimeout((() => { this.popup = L.popup(marker.getLatLng(), params).openOn(this.map); }).bind(this), 100);
    };

    flyTo(ll, zoomlv, options) {
        this.map.flyTo(ll, zoomlv, options);
    };

    getZoom() {
        return this.map.getZoom();
    };

    setZoom(zoomlv) {
        this.map.flyTo(this.map.getCenter(), zoomlv, { animate: true, duration: 0.5 });
    };

    getCenter() {
        return this.map.getBounds().getCenter();
    };

    get_LL(lll) {			// LatLngエリアの設定 [経度lng,緯度lat] lll:少し大きめにする
        let ll = { "NW": this.map.getBounds().getNorthWest(), "SE": this.map.getBounds().getSouthEast() };
        if (lll) {
            ll.NW.lng = ll.NW.lng * 0.99997;
            ll.SE.lng = ll.SE.lng * 1.00003;
            ll.SE.lat = ll.SE.lat * 0.99992;
            ll.NW.lat = ll.NW.lat * 1.00008;
        }
        return ll;
    };

    addDomEvent(dom, event, callback) {
        L.DomEvent.on(dom, event, () => { callback() });
    }

    controlAdd(position, domid, html, css) {     // add leaflet control
        let dom = L.control({ "position": position, "bubblingMouseEvents": false });
        dom.onAdd = function () {
            this.ele = L.DomUtil.create('div');
            this.ele.id = domid;
            this.ele.innerHTML = html;
            this.ele.className = css;
            return this.ele;
        };
        dom.addTo(this.map);
    };

    locateAdd() {                               // add location
        this.Control["locate"] = L.control.locate({
            position: 'bottomright', strings: { title: glot.get("location") },
            setView: "once", locateOptions: { maxZoom: 16 }
        }).addTo(this.map);
    };

    geojsonAdd(data) {
        L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: feature.properties.stroke,
                    weight: feature.properties["stroke-width"]
                };
            }
        }).addTo(this.map);
    }
};

// GeoJson Control
class Geocont {

    // csv(「”」で囲われたカンマ区切りテキスト)をConf.markerのcolumns、tagsをもとにgeojsonへ変換
    csv2geojson(csv, key) {
        let tag_key = [], columns = Conf.osm[key].columns;
        let texts = csv.split(/\r\n|\r|\n/).filter(val => val !== "");
        cols = texts[0].split('","').map(col => col.replace(/^"|"$|/g, ''));
        for (let i = 0; i < cols.length; i++) {
            if (columns[cols[i]] !== undefined) tag_key[i] = columns[cols[i]];
        };
        texts.shift();
        let geojsons = texts.map((text, line) => {
            cols = text.split('","').map(col => col.replace(/^"|"$/g, ''));
            let geojson = { "type": "Feature", "geometry": { "type": "Point", "coordinates": [] }, "properties": {} };
            let tag_val = {};
            for (let i = 0; i < cols.length; i++) {
                if (tag_key[i] !== undefined) {
                    tag_val[tag_key[i]] = tag_val[tag_key[i]] == undefined ? cols[i] : tag_val[tag_key[i]] + cols[i];
                };
            };
            geojson.geometry.coordinates = [tag_val._lng, tag_val._lat];
            geojson.id = `${key}/${line}`;
            Object.keys(tag_val).forEach((idx) => {
                if (idx.slice(0, 1) !== "_") geojson.properties[idx] = tag_val[idx];
            });
            Object.keys(Conf.osm[key].add_tag).forEach(tkey => {
                geojson.properties[tkey] = Conf.osm[key].add_tag[tkey];
            });
            return geojson;
        });
        return geojsons;
    }

    // 2線の交差チェック 線分ab(x,y)とcd(x,y) true:交差 / false:非交差
    judgeIentersected(a, b, c, d) {
        let ta = (c[0] - d[0]) * (a[1] - c[1]) + (c[1] - d[1]) * (c[0] - a[0]);
        let tb = (c[0] - d[0]) * (b[1] - c[1]) + (c[1] - d[1]) * (c[0] - b[0]);
        let tc = (a[0] - b[0]) * (c[1] - a[1]) + (a[1] - b[1]) * (a[0] - c[0]);
        let td = (a[0] - b[0]) * (d[1] - a[1]) + (a[1] - b[1]) * (a[0] - d[0]);
        return tc * td <= 0 && ta * tb <= 0; // 端点を含む
    }

    bboxclip(cords, lll) { // geojsonは[経度lng,緯度lat]
        let LL = leaflet.get_LL(lll);
        new_cords = cords.filter((cord) => {
            if (cord[0] < (LL.NW.lng)) return false;
            if (cord[0] > (LL.SE.lng)) return false;
            if (cord[1] < (LL.SE.lat)) return false;
            if (cord[1] > (LL.NW.lat)) return false;
            return true;
        });
        return new_cords;
    }

    multi2flat(cords, type) {     // MultiPoylgon MultiString -> Polygon(broken) String
        let flats;
        switch (type) {
            case "Point":
                flats = cords;
                break;
            case "LineString":
                flats = [cords];
                break;
            case "MultiPolygon":
                flats = cords.flat();
                break;
            default:
                flats = [cords.flat()];
                break;
        };
        return flats;
    }

    flat2single(cords, type) {  // flat cordsの平均値(Poiの座標計算用)
        let cord;
        const calc_cord = function (cords) {
            let lat = 0, lng = 0, counts = cords.length;
            for (let cord of cords) {
                lat += cord[0];
                lng += cord[1];
            };
            return [lat / counts, lng / counts];
        };
        switch (type) {
            case "Point":
                cord = [cords[0], cords[1]];
                break;
            case "LineString":
                cord = calc_cord(cords);
                break;
            default:
                let lat = 0, lng = 0;
                for (let idx in cords) {
                    cord = calc_cord(cords[idx]);
                    lat += cord[0];
                    lng += cord[1];
                }
                cord = [lat / cords.length, lng / cords.length];
                break;
        };
        return cord;
    }

    // 指定した方位の衝突するcords内のidxを返す
    get_maxll(st_cord, cords, exc_idx, orient) {
        let LLL = leaflet.get_LL(true), idx, ed_cord = [], found = -1;
        if (orient == "N") ed_cord = [st_cord[0], LLL.NW.lat]; // [経度lng,緯度lat]
        if (orient == "S") ed_cord = [st_cord[0], LLL.SE.lat];
        if (orient == "W") ed_cord = [LLL.NW.lng, st_cord[1]];
        if (orient == "E") ed_cord = [LLL.SE.lng, st_cord[1]];

        for (idx = 0; idx < cords.length; idx++) {  //
            if (cords[idx] !== undefined && exc_idx !== idx) {  //
                found = cords[idx].findIndex((ck_cord, ck_id) => {
                    if (ck_id < cords[idx].length - 1) return GeoCont.judgeIentersected(st_cord, ed_cord, ck_cord, cords[idx][ck_id + 1]);
                    return false;
                });
            };
            if (found > -1) break;
        };
        return (found > -1) ? idx : false;
    }

    check_inner(latlng, LL) {          // latlngがLL(get_LL)範囲内であれば true
        return (LL.NW.lat > latlng[0] && LL.SE.lat < latlng[0] && LL.NW.lng < latlng[1] && LL.SE.lng > latlng[1]);
    }

    ll2tile(ll, zoom) {
        const maxLat = 85.05112878;     // 最大緯度
        zoom = parseInt(zoom);
        let lat = parseFloat(ll.lat);       // 緯度
        let lng = parseFloat(ll.lng);       // 経度
        let pixelX = parseInt(Math.pow(2, zoom + 7) * (lng / 180 + 1));
        let tileX = parseInt(pixelX / 256);
        let pixelY = parseInt((Math.pow(2, zoom + 7) / Math.PI) * ((-1 * Math.atanh(Math.sin((Math.PI / 180) * lat))) + Math.atanh(Math.sin((Math.PI / 180) * maxLat))));
        let tileY = parseInt(pixelY / 256);
        return { tileX, tileY };
    }

    tile2ll(tt, zoom, direction) {
        const maxLat = 85.05112878;     // 最大緯度
        zoom = parseInt(zoom);
        if (direction == "SE") {
            tt.tileX++;
            tt.tileY++;
        }
        let pixelX = parseInt(tt.tileX * 256); // タイル座標X→ピクセル座標Y
        let pixelY = parseInt(tt.tileY * 256); // タイル座標Y→ピクセル座標Y
        let lng = 180 * (pixelX / Math.pow(2, zoom + 7) - 1);
        let lat = (180 / Math.PI) * (Math.asin(Math.tanh((-1 * Math.PI / Math.pow(2, zoom + 7) * pixelY) + Math.atanh(Math.sin(Math.PI / 180 * maxLat)))));
        return { lat, lng };
    }

    get_maparea(mode) {	// OverPassクエリのエリア指定
        let LL;
        if (mode == "LLL") {
            LL = leaflet.get_LL(true);
        } else {
            LL = leaflet.get_LL();
        };
        return `(${LL.SE.lat},${LL.NW.lng},${LL.NW.lat},${LL.SE.lng});`;
    }

    // Debug Code
    gcircle(geojson) { // view geojson in map
        let features = [], colors = ["#804040", "#800000", "#FF0080", "#008000", "#00FF00", "#000080", "#0000FF", "#800080", "#FF00FF", "#808000", "#FFFF00", "#008080", "#00FFFF", "#800080", "#FF00FF"];
        let timer = Conf.style.circle.timer;
        if (!Array.isArray(geojson)) {
            if (geojson.features !== undefined) features = geojson.features;
        } else {
            features = geojson;
            if (features[0].geometry == undefined) features = { geometry: { coordinates: geojson } };
        };
        features.forEach((val, idx) => {
            let geo = val.geometry;
            let cords = geo.coordinates.length == 1 && geo.coordinates[0][0].length > 1 ? geo.coordinates[0] : [geo.coordinates];
            cords.forEach((latlng) => {
                Conf.style.circle.radius = Math.pow(2, 22 - leaflet.getZoom());
                let style = Conf.style.circle;
                let color = idx % colors.length;
                style.color = colors[color];
                let circle = L.circle(L.latLng(latlng[1], latlng[0]), style).addTo(leaflet.map);
                //circle.addTo(map).on('click', e => { popup_icon(e) });
                // console.log(`feature[${idx}]: [${latlng[1]}, ${latlng[0]}`);
                setTimeout(() => leaflet.map.removeLayer(circle), timer);
                timer += 50;
            });
        });

        /*
        function popup_icon(ev) {
            let popcont = JSON.stringify(ev.latlng);
            L.responsivePopup({ "keepInView": true }).setContent(popcont).setLatLng(ev.latlng).openOn(map);
            ev.target.openPopup();
            return false;
        };
        */
    }

    ccircle(cords) {   // view cord in map
        let geojson = {
            features: [{
                geometry: { coordinates: cords },
                properties: {},
                type: "Feature"
            }]
        };
        GeoCont.gcircle(geojson);
    }

    box_write(NW, SE) {  // view box
        let bcords = [[NW.lat, NW.lng], [NW.lat, SE.lng], [SE.lat, SE.lng], [SE.lat, NW.lng], [NW.lat, NW.lng]];
        L.polyline(bcords, { color: 'red', weight: 4 }).addTo(map);
    }

    bbox_write() { // view maparea
        let LL = leaflet.get_LL();
        let bcords = [[LL.NW.lat, LL.NW.lng], [LL.NW.lat, LL.SE.lng], [LL.SE.lat, LL.SE.lng], [LL.SE.lat, LL.NW.lng], [LL.NW.lat, LL.NW.lng]];
        L.polyline(bcords, { color: 'red', weight: 4 }).addTo(map);

        LL = leaflet.get_LL(true);
        bcords = [[LL.NW.lat, LL.NW.lng], [LL.NW.lat, LL.SE.lng], [LL.SE.lat, LL.SE.lng], [LL.SE.lat, LL.NW.lng], [LL.NW.lat, LL.NW.lng]];
        L.polyline(bcords, { color: 'black', weight: 4 }).addTo(map);
    }
}

