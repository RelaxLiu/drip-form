import React, {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import DripForm from '@jdfed/drip-form'
import type { Map } from '@jdfed/utils'
import { deepClone, deleteDeepProp, isEmpty, setDeepProp } from '@jdfed/utils'
import cx from 'classnames'
import { SettingOutlined } from '@ant-design/icons'
import { baseMap } from '@generator/fields'
import {
  globalContainerStyleAtom,
  sidebarDataAtom,
  uiTypeOptionsAtom,
} from '@generator/store'
// import BaseForm from './BaseForm'
import useRightSidebar from '../HeadlessComponents'
import rootConfig from '@generator/fields/container/root.field'
import styles from '../index.module.css'
import { original, produce } from 'immer'
import type { SetType } from '@jdfed/hooks'
import { Select } from 'antd'
import { useRecoilState, useRecoilValue } from 'recoil'
import { FieldConfigType } from '@generator/fields/types'
const PropertyConfig = () => {
  const {
    generatorContext,
    selectedFieldKey,
    dataSchema,
    uiSchema,
    uiComponents,
  } = useRightSidebar()
  const [globalContainerStyle, setGlobalContainerStyle] = useRecoilState(
    globalContainerStyleAtom
  )
  const uiTypeOptions = useRecoilValue(uiTypeOptionsAtom)
  const sidebarData = useRecoilValue(sidebarDataAtom)
  // 当前选中的组件UI类型
  const [type, setType] = useState(() => (uiSchema.type as string) || 'root')
  //所有类型的样式配置schema
  const stylesSchemaMap = useMemo<Record<string, FieldConfigType>>(() => {
    return sidebarData.reduce((prev, cur) => {
      return { ...prev, ...cur.config }
    }, {})
  }, [sidebarData])

  useEffect(() => {
    setType((uiSchema.type as string) || 'root')
  }, [uiSchema.type])

  /**
   * 初始化配置数据
   */
  const formData = useMemo(() => {
    return {
      title: uiSchema.title || {},
      containerStyle: uiSchema.containerStyle || {},
      description: uiSchema.description || {},
      ...(type === 'root' && { footer: {} }),
      validateTime: dataSchema?.validateTime || 'change',
      ui: {
        ...uiSchema,
        ...(!!dataSchema.default && { default: dataSchema.default }),
      },
    }
  }, [dataSchema?.validateTime, dataSchema.default, type, uiSchema])

  /**
   * 将数据填充进右侧配置面板前进行处理
   */
  const onParse = useCallback(
    (rawFormData) => {
      // 因为formData是从渲染区的schema中获取的，其为immer；所以此处需要深拷贝一份出来
      const formData = deepClone(rawFormData)
      Object.keys(formData).map((key) => {
        // 提示特殊处理
        if (key === 'description') {
          formData.description.hasDesc =
            Object.keys(formData.description).filter(
              (item) => item !== 'hasDesc'
            ).length > 0
        }
        // 布局特殊处理
        if (key === 'containerStyle') {
          // TODO @jiangxiaowei 暂不支持解析vw、px写法 (vw、px默认转换为百分比)
          formData.containerStyle.width = Number(
            String(
              formData.containerStyle.width ||
                globalContainerStyle?.width ||
                100
            ).split(/%|(vw)|(px)/)[0]
          )
        }
        // 标题特殊处理
        if (key === 'title') {
          formData.title = Object.assign({}, uiSchema.title, {
            title: dataSchema?.title || '',
            followRootConfig: isEmpty(uiSchema.title),
            // showTitle: uiSchema?.showTitle || true,
          })
        }
        if (key === 'footer') {
          formData.footer = Object.assign({}, uiSchema.footer, {
            showFooter: !isEmpty(uiSchema.footer),
            // onOk:uiSchema?.footer?.onOk||'',
            // onCancel:
          })
        }
      })
      return formData
    },
    [
      dataSchema?.title,
      globalContainerStyle?.width,
      uiSchema.footer,
      uiSchema.title,
    ]
  )

  /**
   * 监听配置区修改，实时更新到渲染区
   */
  const onChangeSchema = useCallback(
    ({ changeKey, get }) => {
      // 当chengKey为空字符串时，认为为ajv校验或初始化执行的操作，不做实时更新
      if (changeKey === '') return
      // 当前修改的字段处理为为可映射到渲染区schema的路径
      let key = changeKey
      let data = get(key).data
      // 是否设置formData，默认不设置
      let setFormData = false
      // 需要设置的表单数据
      let fieldData
      // 默认均修改uiSchema
      let changeSchema = 'uiSchema'
      // 处理全局属性
      if (changeKey === 'validateTime') {
        changeSchema = 'dataSchema'
      }
      if (type === 'slider') {
        if (changeKey === 'ui.range') {
          setFormData = true
          if (data === true) {
            fieldData = [uiSchema?.min || 0, uiSchema?.max || 100]
          } else {
            fieldData = uiSchema?.min || 0
          }
        }
      }
      if (changeKey.startsWith('ui.options.')) {
        data = get('ui.options').data
        key = 'ui.options'
      }
      if (changeKey === 'containerStyle.width') {
        if (type === 'root') {
          setGlobalContainerStyle({ width: data })
        }
        // TODO @jiangxiaowei 后续支持px、vw
        data = data + '%'
      }
      if (changeKey === 'description.hasDesc') {
        // 如果展示description，则获取当前配置的全部信息进行填充
        if (data === true) {
          key = 'description'
          // description所有配置
          data = produce(get(key).data, (draft: Map) => {
            delete draft.hasDesc
          })
        } else {
          key = 'description'
          data = {}
        }
      }
      // 标题需要设置到dataSchema中呢
      if (changeKey === 'title.title') {
        key = 'title'
        changeSchema = 'dataSchema'
      }
      if (changeKey === 'title.showTitle') {
        key = 'showTitle'
      }
      if (changeKey === 'title.followRootConfig') {
        if (data) {
          key = 'title'
          data = {}
        } else {
          key = 'title'
          data = produce(get(key).data, (draft: Map) => {
            delete draft.followRootConfig
          })
        }
      }
      if (changeKey === 'footer.showFooter') {
        if (data) {
          key = 'footer'
          data = produce(get(key).data, (draft: Map) => {
            delete draft.showFooter
          })
        } else {
          key = 'footer'
          data = {}
        }
      }
      if (changeKey.includes('ui.default')) {
        changeSchema = 'dataSchema'
        // 在ajv校验时，如果formData中已经有值，则不再生成新的formData，需要set formData
        setFormData = true
      }
      // 填充渲染区Schema
      generatorContext.current?.set(
        selectedFieldKey || '',
        changeSchema as SetType,
        (draft) => {
          setDeepProp(
            key.split('.').filter((item: string) => !['ui'].includes(item)),
            draft as Map,
            data
          )
        }
      )
      if (setFormData) {
        generatorContext.current?.set(
          selectedFieldKey || '',
          'data',
          fieldData as any
        )
      }
    },
    [
      generatorContext,
      selectedFieldKey,
      setGlobalContainerStyle,
      type,
      uiSchema?.max,
      uiSchema?.min,
    ]
  )

  /**
   * 切换属性配置
   */
  const onReplace = useCallback((draft, schema) => {
    // 待删除的key
    const needToDelete = Object.keys(original(draft) as Map)

    for (const key in schema) {
      setDeepProp([key], draft as Map, schema[key])
      // 已填充的字段不应该被删除
      const idxInDraft = needToDelete.findIndex((val) => val === key)
      if (idxInDraft >= 0) {
        needToDelete.splice(idxInDraft, 1)
      }
    }

    for (const key of needToDelete) {
      deleteDeepProp([key], draft as Map)
    }
  }, [])

  /**
   * 修改ui类型
   */
  const onChangeUiType = useCallback(
    (val) => {
      let dataSchema: Map, uiSchema: Map
      uiTypeOptions.every((item) => {
        if (item.value === val) {
          uiSchema = deepClone(item.schema.ui)
          dataSchema = deepClone(item.schema)
          // 移除uiSchema配置
          Reflect.deleteProperty(dataSchema, 'ui')
          return false
        }

        return true
      })

      generatorContext.current?.set(
        selectedFieldKey || '',
        'dataSchema',
        (draft) => {
          onReplace(draft, dataSchema)
        }
      )
      generatorContext.current?.set(
        selectedFieldKey || '',
        'uiSchema',
        (draft) => {
          onReplace(draft, uiSchema)
        }
      )
      // 更新类型
      setType(val)
    },
    [generatorContext, onReplace, selectedFieldKey, uiTypeOptions]
  )

  /**
   * 不同表单项生成不同的联合schema
   */
  const unitedSchema = useMemo(() => {
    return {
      validateTime: 'change',
      theme: 'antd',
      schema:
        type === 'root'
          ? rootConfig
          : [
              // 标题配置
              baseMap.title,
              // 提示配置
              baseMap.description,
              // 布局配置
              baseMap.layout,
              // 样式配置
              ...(stylesSchemaMap[type as keyof typeof stylesSchemaMap]
                .styleSchema
                ? [
                    {
                      type: 'object',
                      fieldKey: 'ui',
                      ui: {
                        type: 'object',
                        mode: 'collapse',
                      },
                      title: '样式',
                      schema:
                        stylesSchemaMap[type as keyof typeof stylesSchemaMap]
                          .styleSchema,
                    },
                  ]
                : []),
            ],
    }
  }, [stylesSchemaMap, type])

  return (
    <Fragment>
      <div className={styles.panelConfig}>
        {type !== 'root' && (
          <div className={cx(styles.propertyConfig)}>
            <div className={styles.propertyConfigTitle}>
              <SettingOutlined className={cx(styles.icon)} />
              <span>组件类型</span>
            </div>
            <div className={styles.propertyConfigContent}>
              <Select
                style={{
                  width: '100%',
                }}
                value={type}
                onChange={onChangeUiType}
                options={uiTypeOptions}
              />
            </div>
          </div>
        )}
        <DripForm
          formData={formData}
          parse={onParse}
          control={onChangeSchema}
          unitedSchema={unitedSchema}
          uiComponents={uiComponents}
        />
      </div>
    </Fragment>
  )
}

export default memo(PropertyConfig)
