import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
import detail from './detail'
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/pembelian/purchase-order',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::index
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:405
 * @route '/pembelian/purchase-order'
 */
        indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    index.form = indexForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/pembelian/purchase-order/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
    const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: create.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
        createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::create
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:11
 * @route '/pembelian/purchase-order/create'
 */
        createForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    create.form = createForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
export const edit = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/pembelian/purchase-order/{noPo}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
edit.url = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPo: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPo: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPo: args.noPo,
                }

    return edit.definition.url
            .replace('{noPo}', parsedArgs.noPo.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
edit.get = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
edit.head = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
    const editForm = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: edit.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
        editForm.get = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: edit.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::edit
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:69
 * @route '/pembelian/purchase-order/{noPo}/edit'
 */
        editForm.head = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: edit.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    edit.form = editForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
export const print = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})

print.definition = {
    methods: ["get","head"],
    url: '/pembelian/purchase-order/{noPo}/print',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
print.url = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPo: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPo: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPo: args.noPo,
                }

    return print.definition.url
            .replace('{noPo}', parsedArgs.noPo.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
print.get = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
print.head = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: print.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
    const printForm = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: print.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
        printForm.get = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::print
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:471
 * @route '/pembelian/purchase-order/{noPo}/print'
 */
        printForm.head = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    print.form = printForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::store
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:144
 * @route '/pembelian/purchase-order'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/pembelian/purchase-order',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::store
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:144
 * @route '/pembelian/purchase-order'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::store
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:144
 * @route '/pembelian/purchase-order'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::store
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:144
 * @route '/pembelian/purchase-order'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::store
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:144
 * @route '/pembelian/purchase-order'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:280
 * @route '/pembelian/purchase-order/{noPo}'
 */
export const update = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/pembelian/purchase-order/{noPo}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:280
 * @route '/pembelian/purchase-order/{noPo}'
 */
update.url = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPo: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPo: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPo: args.noPo,
                }

    return update.definition.url
            .replace('{noPo}', parsedArgs.noPo.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:280
 * @route '/pembelian/purchase-order/{noPo}'
 */
update.put = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:280
 * @route '/pembelian/purchase-order/{noPo}'
 */
    const updateForm = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseOrderController::update
 * @see app/Http/Controllers/Marketing/PurchaseOrderController.php:280
 * @route '/pembelian/purchase-order/{noPo}'
 */
        updateForm.put = (args: { noPo: string | number } | [noPo: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
const purchaseOrder = {
    index: Object.assign(index, index),
create: Object.assign(create, create),
edit: Object.assign(edit, edit),
print: Object.assign(print, print),
store: Object.assign(store, store),
update: Object.assign(update, update),
detail: Object.assign(detail, detail),
}

export default purchaseOrder