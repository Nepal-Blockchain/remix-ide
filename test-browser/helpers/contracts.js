'use strict'
var deepequal = require('deep-equal')

module.exports = {
  getCompiledContracts,
  testContracts,
  addFile,
  switchFile,
  verifyContract,
  selectContract,
  testConstantFunction,
  checkDebug,
  goToVMtraceStep,
  useFilter,
  addInstance,
  verifyCallReturnValue,
  createContract,
  renameFile,
  removeFile,
  getAddressAtPosition,
  signMsg
}

function getCompiledContracts (browser, compiled, callback) {
  browser.clickLaunchIcon('solidity').execute(function () {
    var contracts = document.querySelectorAll('#compileTabView select option')
    if (!contracts) {
      return null
    } else {
      var ret = []
      for (var c = 0; c < contracts.length; c++) {
        ret.push(contracts[c].value)
      }
      return ret
    }
  }, [], function (result) {
    callback(result)
  })
}

function selectContract (browser, contractName, callback) {
  browser.clickLaunchIcon('settings').clickLaunchIcon('run')
  .setValue('#runTabView select[class^="contractNames"]', contractName).perform(() => {
    callback()
  })
}

function createContract (browser, inputParams, callback) {
  browser.clickLaunchIcon('settings').clickLaunchIcon('run')
  .setValue('div[class^="contractActionsContainerSingle"] input', inputParams, function () {
    browser.click('#runTabView button[class^="instanceButton"]').pause(500).perform(function () { callback() })
  })
}

function verifyContract (browser, compiledContractNames, callback) {
  getCompiledContracts(browser, compiledContractNames, (result) => {
    if (result.value) {
      for (var contract in compiledContractNames) {
        console.log(' - ' + compiledContractNames[contract])
        if (result.value.indexOf(compiledContractNames[contract]) === -1) {
          browser.assert.fail('compiled contract ' + compiledContractNames + ' not found', 'info about error', '')
          browser.end()
          return
        }
      }
    } else {
      browser.assert.fail('compiled contract ' + compiledContractNames + ' not found - none found', 'info about error', '')
      browser.end()
    }
    console.log('contracts all found ' + compiledContractNames)
    callback()
  })
}

function testContracts (browser, fileName, contractCode, compiledContractNames, callback) {
  browser
    .clickLaunchIcon('solidity')
    .clearValue('#input textarea')
    .perform((client, done) => {
      addFile(browser, fileName, contractCode, done)
    })
    .pause(1000)
    .perform(function () {
      verifyContract(browser, compiledContractNames, callback)
    })
}

function verifyCallReturnValue (browser, address, checks, done) {
  console.log('verifyCallReturnValue address', address)
  browser.execute(function (address) {
    var nodes = document.querySelectorAll('#instance' + address + ' div[class^="contractActionsContainer"] div[class^="value"]')
    var ret = []
    for (var k = 0; k < nodes.length; k++) {
      var text = nodes[k].innerText ? nodes[k].innerText : nodes[k].textContent
      ret.push(text.replace('\n', ''))
    }
    return ret
  }, [address], function (result) {
    console.log('verifyCallReturnValue', result)
    for (var k in checks) {
      browser.assert.equal(result.value[k], checks[k])
    }
    done()
  })
}

function getAddressAtPosition (browser, index, callback) {
  index = index + 2
  browser.execute(function (index) {
    return document.querySelector('.instance:nth-of-type(' + index + ')').getAttribute('id').replace('instance', '')
  }, [index], function (result) {
    callback(result.value)
  })
}

function testConstantFunction (browser, address, fnFullName, expectedInput, expectedOutput, cb) {
  browser.waitForElementPresent('.instance button[title="' + fnFullName + '"]').perform(function (client, done) {
    client.execute(function () {
      document.querySelector('#runTabView').scrollTop = document.querySelector('#runTabView').scrollHeight
    }, [], function () {
      if (expectedInput) {
        client.setValue('#runTabView input[title="' + expectedInput.types + '"]', expectedInput.values, function () {})
      }
      done()
    })
  })
  .click('.instance button[title="' + fnFullName + '"]')
  .pause(1000)
  .waitForElementPresent('#instance' + address + ' div[class^="contractActionsContainer"] div[class^="value"]')
  .scrollInto('#instance' + address + ' div[class^="contractActionsContainer"] div[class^="value"]')
  .assert.containsText('#instance' + address + ' div[class^="contractActionsContainer"] div[class^="value"]', expectedOutput).perform(() => {
    cb()
  })
}

function signMsg (browser, msg, cb) {
  let hash, signature
  browser
    .waitForElementPresent('i[id="remixRunSignMsg"]')
    .click('i[id="remixRunSignMsg"]')
    .waitForElementPresent('textarea[id="prompt_text"]')
    .setValue('textarea[id="prompt_text"]', msg, () => {
      browser.modalFooterOKClick().perform(
        (client, done) => {
          browser.getText('span[id="remixRunSignMsgHash"]', (v) => { hash = v; done() })
        }
      )
      .perform(
        (client, done) => {
          browser.getText('span[id="remixRunSignMsgSignature"]', (v) => { signature = v; done() })
        }
      )
      .modalFooterOKClick()
      .perform(
        () => {
          cb(hash, signature)
        }
      )
    })
}

function addInstance (browser, address, isValidFormat, isValidChecksum, callback) {
  browser.clickLaunchIcon('run').clearValue('.ataddressinput').setValue('.ataddressinput', address, function () {
    browser.click('div[class^="atAddress"]')
      .execute(function () {
        var ret = document.querySelector('div[class^="modal-body"] div').innerHTML
        document.querySelector('#modal-footer-ok').click()
        return ret
      }, [], function (result) {
        if (!isValidFormat) {
          browser.assert.equal(result.value, 'Invalid address.')
        } else if (!isValidChecksum) {
          browser.assert.equal(result.value, 'Invalid checksum address.')
        }
        callback()
      })
  })
}

function addFile (browser, name, content, done) {
  browser.clickLaunchIcon('run').clickLaunchIcon('fileExplorers').click('.newFile')
    .perform((client, done) => {
      browser.execute(function (fileName) {
        if (fileName !== 'Untitled.sol') {
          document.querySelector('#modal-dialog #prompt_text').setAttribute('value', fileName)
        }
        document.querySelector('#modal-footer-ok').click()
      }, [name], function (result) {
        console.log(result)
        done()
      })
    })
    .setEditorValue(content.content)
    .pause(1000)
    .perform(function () {
      done()
    })
}

function renameFile (browser, path, newFileName, renamedPath, done) {
  browser.execute(function (path) {
    function contextMenuClick (element) {
      var evt = element.ownerDocument.createEvent('MouseEvents')
      var RIGHT_CLICK_BUTTON_CODE = 2 // the same for FF and IE
      evt.initMouseEvent('contextmenu', true, true,
          element.ownerDocument.defaultView, 1, 0, 0, 0, 0, false,
          false, false, false, RIGHT_CLICK_BUTTON_CODE, null)
      if (document.createEventObject) {
        // dispatch for IE
        return element.fireEvent('onclick', evt)
      } else {
        // dispatch for firefox + others
        return !element.dispatchEvent(evt)
      }
    }
    contextMenuClick(document.querySelector('[data-path="' + path + '"]'))
  }, [path], function (result) {
    browser
    .click('#menuitemrename')
    .perform((client, doneSetValue) => {
      browser.execute(function (path, addvalue) {
        document.querySelector('[data-path="' + path + '"]').innerHTML = addvalue
      }, [path, newFileName], () => {
        doneSetValue()
      })
    })
    .click('body') // blur
    .pause(500)
    .click('#modal-footer-ok')
    .waitForElementNotPresent('[data-path="' + path + '"]')
    .waitForElementPresent('[data-path="' + renamedPath + '"]')
    .perform(() => {
      done()
    })
  })
}

function removeFile (browser, path, done) {
  browser.execute(function (path, value) {
    function contextMenuClick (element) {
      var evt = element.ownerDocument.createEvent('MouseEvents')
      var RIGHT_CLICK_BUTTON_CODE = 2 // the same for FF and IE
      evt.initMouseEvent('contextmenu', true, true,
          element.ownerDocument.defaultView, 1, 0, 0, 0, 0, false,
          false, false, false, RIGHT_CLICK_BUTTON_CODE, null)
      if (document.createEventObject) {
        // dispatch for IE
        return element.fireEvent('onclick', evt)
      } else {
        // dispatch for firefox + others
        return !element.dispatchEvent(evt)
      }
    }
    contextMenuClick(document.querySelector('[data-path="' + path + '"]'))
  }, [path], function (result) {
    browser
    .click('#menuitemdelete')
    .pause(500)
    .click('#modal-footer-ok')
    .waitForElementNotPresent('[data-path="' + path + '"]')
    .perform(() => {
      done()
    })
  })
}

function useFilter (browser, filter, test, done) {
  if (browser.options.desiredCapabilities.browserName === 'chrome') { // nightwatch deos not handle well that part.... works locally
    done()
    return
  }
  var filterClass = '#editor-container div[class^="search"] input[class^="filter"]'
  browser.setValue(filterClass, filter, function () {
    browser.execute(function () {
      return document.querySelector('#editor-container div[class^="journal"]').innerHTML === test
    }, [], function (result) {
      browser.clearValue(filterClass).setValue(filterClass, '', function () {
        if (!result.value) {
          browser.assert.fail('useFilter on ' + filter + ' ' + test, 'info about error', '')
        }
        done()
      })
    })
  })
}

function switchFile (browser, name, done) {
  browser.clickLaunchIcon('settings').clickLaunchIcon('fileExplorers')
    .click('li[key="' + name + '"]')
    .pause(2000)
    .perform(() => {
      done()
    })
}

function checkDebug (browser, id, debugValue, done) {
  // id is soliditylocals or soliditystate
  browser.execute(function (id) {
    return document.querySelector('#' + id + ' .dropdownrawcontent').innerText
  }, [id], function (result) {
    console.log(id + ' ' + result.value)
    var value
    try {
      value = JSON.parse(result.value)
    } catch (e) {
      browser.assert.fail('cant parse solidity state', e.message, '')
      done()
      return
    }
    var equal = deepequal(debugValue, value)
    if (!equal) {
      browser.assert.fail('checkDebug on ' + id, 'info about error', '')
    }
    done()
  })
}

function goToVMtraceStep (browser, step, done, incr) {
  if (!incr) incr = 0
  browser.execute(function (step) {
    return document.querySelector('#stepdetail').innerHTML
  }, [step], function (result) {
    if (result.value.indexOf('vm trace step: ' + step) !== -1) {
      done()
    } else if (incr > 1000) {
      console.log(result)
      browser.assert.fail('goToVMtraceStep fails', 'info about error', '')
      done()
    } else {
      incr++
      browser.click('#intoforward')
        .perform(() => {
          setTimeout(() => {
            goToVMtraceStep(browser, step, done, incr)
          }, 200)
        })
    }
  })
}
