import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
import detail from './detail'
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/marketing/purchase-requirement',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::index
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:11
 * @route '/marketing/purchase-requirement'
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
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
 */
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/marketing/purchase-requirement/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
 */
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
 */
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
 */
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
 */
    const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: create.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
 */
        createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::create
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:69
 * @route '/marketing/purchase-requirement/create'
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
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
export const edit = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/marketing/purchase-requirement/{noPr}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
edit.url = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPr: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPr: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPr: args.noPr,
                }

    return edit.definition.url
            .replace('{noPr}', parsedArgs.noPr.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
edit.get = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
edit.head = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
    const editForm = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: edit.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
        editForm.get = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: edit.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::edit
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:86
 * @route '/marketing/purchase-requirement/{noPr}/edit'
 */
        editForm.head = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
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
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::store
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:121
 * @route '/marketing/purchase-requirement'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/marketing/purchase-requirement',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::store
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:121
 * @route '/marketing/purchase-requirement'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::store
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:121
 * @route '/marketing/purchase-requirement'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::store
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:121
 * @route '/marketing/purchase-requirement'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::store
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:121
 * @route '/marketing/purchase-requirement'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:198
 * @route '/marketing/purchase-requirement/{noPr}'
 */
export const update = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/marketing/purchase-requirement/{noPr}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:198
 * @route '/marketing/purchase-requirement/{noPr}'
 */
update.url = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPr: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPr: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPr: args.noPr,
                }

    return update.definition.url
            .replace('{noPr}', parsedArgs.noPr.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:198
 * @route '/marketing/purchase-requirement/{noPr}'
 */
update.put = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:198
 * @route '/marketing/purchase-requirement/{noPr}'
 */
    const updateForm = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::update
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:198
 * @route '/marketing/purchase-requirement/{noPr}'
 */
        updateForm.put = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
export const print = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})

print.definition = {
    methods: ["get","head"],
    url: '/marketing/purchase-requirement/{noPr}/print',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
print.url = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPr: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPr: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPr: args.noPr,
                }

    return print.definition.url
            .replace('{noPr}', parsedArgs.noPr.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
print.get = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
print.head = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: print.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
    const printForm = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: print.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
        printForm.get = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\PurchaseRequirementController::print
 * @see app/Http/Controllers/Marketing/PurchaseRequirementController.php:311
 * @route '/marketing/purchase-requirement/{noPr}/print'
 */
        printForm.head = (args: { noPr: string | number } | [noPr: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    print.form = printForm
const purchaseRequirement = {
    index: Object.assign(index, index),
create: Object.assign(create, create),
edit: Object.assign(edit, edit),
store: Object.assign(store, store),
update: Object.assign(update, update),
detail: Object.assign(detail, detail),
print: Object.assign(print, print),
}

export default purchaseRequirement