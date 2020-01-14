/**





@typedef
{
""|"folder"|"animation-clip"|"asset"|"audio-clip"|"auto-atlas"|"bitmap-font"|"buffer"|"coffeescript"|"dragonbones"|"dragonbones-atlas"|"dragonbones-bin"|"effect"|"fbx"|"font"|"gltf"|"javascript"|"json"|"label-atlas"|"markdown"|"material"|"mesh"|"native-asset"|"particle"|"prefab"|"raw-asset"|"scene"|"skeleton"|"skeleton-animation-clip"|"spine"|"sprite-atlas"|"sprite-frame"|"text"|"texture"|"texture-packer"|"tiled-map"|"ttf-font"|"typescript"
} AssetType
@typedef
{{
    destPath: string
    hidden: boolean
    isSubAsset: boolean
    path: tring
    readonly: boolean
    type: AssetType
    url: string
    uuid: string
}} Asset


@typedef
{{
    mainPack: Package,
    subpackArr: Package[],
    packageSaveDir: string,
    isDebug: boolean,
}} PlugConfig  插件配置信息


@typedef
{{
    name: string
    zhName: string
    zipImport: boolean
    zipRawassets: boolean
    isPrivate: boolean
    type: "LOCAL" | "HOT_UPDATE" | "REMOTE"
    version: string
    packageUrl: string
    resDirs: string[]
}} Package 插件子包对象结构

@typedef
{{
    version: string
    name: string        // 追加包名
    zhName: string      // 追加中文包名
    packageUrl: string
    remoteManifestUrl: string
    remoteVersionUrl: string
    assets: ManifestAssets,
    searchPaths: string[]
}} Manifest 热更清单文件内容

@typedef
{{
    [key:string]:{
        size: number
        md5: string
        compressed: boolean
    }
}} ManifestAssets 热更清单文件中的资源列表结构

@typedef
{{
    name: string
    path: string
    uuids: string[]
}} Pack 引擎构建后的子包对象结构

@typedef
{{
    [packName: string]: Pack
}} Subpackages 引擎构建后的所有子包
*/

